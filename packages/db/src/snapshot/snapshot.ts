import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { getSetting, setSetting, totalChanges, type Treasury } from '../client.ts';
import { exportDefinitions } from '../definitions.ts';
import { driveLayout, removeIfExists, requireDrive, writeFileAtomic } from './drive.ts';
import { decrypt, encrypt, SnapshotKeyError, type SnapshotKey } from './encryption.ts';

export interface Manifest {
	readonly format: 1;
	/** Which database this snapshot belongs to. */
	readonly instance_id: string;
	/** Counts up with every snapshot of this database; a lower number is an older copy. */
	readonly generation: number;
	readonly taken_at: string;
	readonly app_version: string;
	readonly encrypted: boolean;
	readonly file: string;
	readonly bytes: number;
	/** SHA-256 of the unencrypted database, checked on restore. */
	readonly sha256: string;
}

/** Drive holds a snapshot this database must not overwrite. */
export class SnapshotConflictError extends Error {
	readonly manifest: Manifest;
	constructor(message: string, manifest: Manifest) {
		super(message);
		this.name = 'SnapshotConflictError';
		this.manifest = manifest;
	}
}

export interface SnapshotTarget {
	readonly treasury: Treasury;
	/** The app's Drive folder, e.g. /app/drive (Niijima-network/Treasure on Drive). */
	readonly driveDir: string;
	/** A local folder for temporary files. */
	readonly workDir: string;
	/** Encrypt with this key; null writes an unencrypted snapshot. */
	readonly key: SnapshotKey | null;
	readonly appVersion: string;
}

export interface TakeOptions {
	/** Also keep dated daily and monthly copies (the nightly run). */
	readonly dated?: { readonly day: string; readonly month: string };
	/** Retention for dated copies. */
	readonly keep?: { readonly daily: number; readonly monthly: number };
	/** Extra text files to write to the Drive folder, by name (e.g. config.yml). */
	readonly extras?: Readonly<Record<string, string>>;
}

export interface SnapshotResult {
	readonly manifest: Manifest;
	readonly datedCopies: readonly string[];
	readonly pruned: readonly string[];
	/** Changes counter right after the snapshot, so the scheduler can ignore its own writes. */
	readonly changesAfter: number;
}

const GENERATION_KEY = 'snapshot_generation';

export function readManifest(driveDir: string): Manifest | null {
	const path = driveLayout(driveDir).manifest;
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
		return parsed.format === 1 ? parsed : null;
	} catch {
		return null;
	}
}

function checkOwnership(target: SnapshotTarget, manifest: Manifest | null, generation: number) {
	if (!manifest) return;
	if (manifest.instance_id !== target.treasury.instanceId) {
		throw new SnapshotConflictError(
			'Drive already holds a snapshot of a different database, so it was not overwritten. ' +
				'If this server lost its data, stop the app, delete the local database file and start it ' +
				'again: it restores from Drive automatically. To deliberately start over, delete the ' +
				'snapshots/latest.* files on Drive first.',
			manifest
		);
	}
	if (manifest.generation > generation) {
		throw new SnapshotConflictError(
			`Drive holds a newer snapshot of this database (generation ${manifest.generation}, this ` +
				`copy is at ${generation}), probably written by another server. It was not overwritten.`,
			manifest
		);
	}
}

function prune(folder: string, keep: number): string[] {
	if (!existsSync(folder)) return [];
	const files = readdirSync(folder)
		.filter((name) => !name.endsWith('.partial'))
		.sort()
		.reverse();
	const removed = files.slice(keep);
	for (const name of removed) rmSync(join(folder, name), { force: true });
	return removed;
}

/**
 * Writes a consistent copy of the live database to Drive. The database keeps running while the
 * copy is taken (SQLite online backup), and nothing on Drive is replaced until the new file is
 * complete.
 */
export async function takeSnapshot(
	target: SnapshotTarget,
	options: TakeOptions = {}
): Promise<SnapshotResult> {
	const { treasury, driveDir, workDir, key, appVersion } = target;
	await requireDrive(driveDir);
	const layout = driveLayout(driveDir);

	const current = getSetting<number>(treasury.db, GENERATION_KEY) ?? 0;
	const existing = readManifest(driveDir);
	checkOwnership(target, existing, current);

	// Bump the generation first so the copy itself carries it.
	const generation = Math.max(current, existing?.generation ?? 0) + 1;
	setSetting(treasury.db, GENERATION_KEY, generation);

	mkdirSync(workDir, { recursive: true });
	const staging = join(workDir, `snapshot-${process.pid}-${Date.now()}.db`);
	try {
		await treasury.sqlite.backup(staging);
		const plain = new Uint8Array(readFileSync(staging));
		const payload = key ? await encrypt(plain, key) : plain;
		const latest = layout.latest(key !== null);

		writeFileAtomic(latest, payload);
		// An older snapshot in the other format would be stale; remove it.
		removeIfExists(layout.latest(key === null));

		const manifest: Manifest = {
			format: 1,
			instance_id: treasury.instanceId,
			generation,
			taken_at: new Date().toISOString(),
			app_version: appVersion,
			encrypted: key !== null,
			file: latest.slice(layout.snapshots.length + 1),
			bytes: plain.byteLength,
			sha256: createHash('sha256').update(plain).digest('hex')
		};
		writeFileAtomic(layout.manifest, `${JSON.stringify(manifest, null, 2)}\n`);

		const extension = key ? '.db.age' : '.db';
		const datedCopies: string[] = [];
		const pruned: string[] = [];
		if (options.dated) {
			const daily = join(layout.daily, `${options.dated.day}${extension}`);
			const monthly = join(layout.monthly, `${options.dated.month}${extension}`);
			writeFileAtomic(daily, payload);
			writeFileAtomic(monthly, payload);
			datedCopies.push(daily, monthly);
			const keep = options.keep ?? { daily: 14, monthly: 12 };
			pruned.push(...prune(layout.daily, keep.daily), ...prune(layout.monthly, keep.monthly));
		}

		writeFileAtomic(layout.definitions, exportDefinitions(treasury.db));
		for (const [name, text] of Object.entries(options.extras ?? {})) {
			writeFileAtomic(join(driveDir, name), text);
		}

		return { manifest, datedCopies, pruned, changesAfter: totalChanges(treasury.sqlite) };
	} finally {
		rmSync(staging, { force: true });
	}
}

export interface RestoreResult {
	readonly restored: boolean;
	readonly reason: string;
	readonly manifest: Manifest | null;
}

/**
 * Restores the latest snapshot from Drive when the local database file is missing.
 * Never touches an existing local database.
 */
export async function restoreIfMissing(options: {
	readonly dbPath: string;
	readonly driveDir: string;
	readonly key: SnapshotKey | null;
}): Promise<RestoreResult> {
	const { dbPath, driveDir, key } = options;
	if (existsSync(dbPath)) {
		return { restored: false, reason: 'a local database already exists', manifest: null };
	}
	await requireDrive(driveDir);
	const manifest = readManifest(driveDir);
	if (!manifest) {
		return { restored: false, reason: 'Drive has no snapshot yet; starting fresh', manifest: null };
	}

	const source = join(driveLayout(driveDir).snapshots, manifest.file);
	if (!existsSync(source)) {
		throw new Error(`latest.json points to ${manifest.file}, but that file is missing on Drive.`);
	}
	let data: Uint8Array = new Uint8Array(readFileSync(source));
	if (manifest.encrypted) {
		if (!key) {
			throw new SnapshotKeyError(
				'Drive holds an encrypted snapshot but SNAPSHOT_KEY is not set, so it cannot be restored. ' +
					'Set SNAPSHOT_KEY to the key you created it with.'
			);
		}
		data = await decrypt(data, key);
	}
	const checksum = createHash('sha256').update(data).digest('hex');
	if (checksum !== manifest.sha256) {
		throw new Error('The snapshot on Drive is damaged (checksum mismatch); it was not restored.');
	}

	for (const suffix of ['-wal', '-shm']) removeIfExists(`${dbPath}${suffix}`);
	writeFileAtomic(dbPath, data);
	return {
		restored: true,
		reason: `restored generation ${manifest.generation} from ${manifest.taken_at}`,
		manifest
	};
}
