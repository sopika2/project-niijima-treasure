import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.ts';

export type Db = BetterSQLite3Database<typeof schema>;

export interface Treasury {
	readonly db: Db;
	/** The raw SQLite handle, used for online backups. */
	readonly sqlite: Database.Database;
	/** Random id given to this database when it was created; snapshots carry it. */
	readonly instanceId: string;
	close(): void;
}

export interface OpenOptions {
	/** Path to the database file, or ":memory:". */
	readonly path: string;
	/** Folder holding the SQL migrations (packages/db/migrations). */
	readonly migrationsFolder: string;
}

/** Opens (or creates) the database, applies pending migrations and returns a ready handle. */
export function openDatabase({ path, migrationsFolder }: OpenOptions): Treasury {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('synchronous = NORMAL');

	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder });

	const instanceId = ensureInstanceId(db);
	return { db, sqlite, instanceId, close: () => sqlite.close() };
}

function ensureInstanceId(db: Db): string {
	const existing = getSetting<string>(db, 'instance_id');
	if (typeof existing === 'string') return existing;
	const created = crypto.randomUUID();
	setSetting(db, 'instance_id', created);
	return created;
}

export function getSetting<T>(db: Db, key: string): T | undefined {
	const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
	return row?.value as T | undefined;
}

export function setSetting(db: Db, key: string, value: unknown): void {
	db.insert(schema.settings)
		.values({ key, value })
		.onConflictDoUpdate({
			target: schema.settings.key,
			set: { value, updatedAt: new Date().toISOString() }
		})
		.run();
}

/** How many rows this connection has changed since it opened; used to notice edits. */
export function totalChanges(sqlite: Database.Database): number {
	const row = sqlite.prepare('SELECT total_changes() AS n').get() as { n: number };
	return row.n;
}
