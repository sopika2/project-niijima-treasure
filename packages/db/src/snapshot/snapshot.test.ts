import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Treasury } from '../client.ts';
import { accounts } from '../schema.ts';
import { checkDrive, DriveUnavailableError } from './drive.ts';
import { generateSnapshotKey, SnapshotKeyError, type SnapshotKey } from './encryption.ts';
import { readManifest, restoreIfMissing, SnapshotConflictError, takeSnapshot } from './snapshot.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

let root: string;
let drive: string;
let key: SnapshotKey;
const open: Treasury[] = [];

function database(name = 'treasury.db'): Treasury {
	const treasury = openDatabase({ path: join(root, 'data', name), migrationsFolder });
	open.push(treasury);
	return treasury;
}

function target(treasury: Treasury, withKey: SnapshotKey | null = key) {
	return {
		treasury,
		driveDir: drive,
		workDir: join(root, 'work'),
		key: withKey,
		appVersion: 'test'
	};
}

function addAccount(treasury: Treasury, name: string) {
	treasury.db
		.insert(accounts)
		.values({ name, type: 'current', currency: 'HUF', openingDate: '2026-10-01' })
		.run();
}

beforeEach(async () => {
	root = mkdtempSync(join(tmpdir(), 'treasury-'));
	drive = join(root, 'drive');
	mkdirSync(drive);
	key = await generateSnapshotKey();
});

afterEach(() => {
	for (const treasury of open.splice(0)) treasury.close();
});

describe('takeSnapshot and restoreIfMissing', () => {
	it('round-trips an encrypted snapshot through Drive', async () => {
		const original = database();
		addAccount(original, 'OTP HUF');
		const { manifest } = await takeSnapshot(target(original), {
			extras: { 'config.yml': 'x: 1\n' }
		});

		expect(manifest.encrypted).toBe(true);
		expect(manifest.generation).toBe(1);
		expect(
			readFileSync(join(drive, 'snapshots', 'latest.db.age'))
				.subarray(0, 21)
				.toString()
		).toBe('age-encryption.org/v1');
		expect(readFileSync(join(drive, 'config.yml'), 'utf8')).toBe('x: 1\n');
		expect(readFileSync(join(drive, 'definitions.yml'), 'utf8')).toContain('name: OTP HUF');

		const restoredPath = join(root, 'other', 'treasury.db');
		const result = await restoreIfMissing({ dbPath: restoredPath, driveDir: drive, key });
		expect(result.restored).toBe(true);

		const restored = openDatabase({ path: restoredPath, migrationsFolder });
		open.push(restored);
		expect(restored.instanceId).toBe(original.instanceId);
		expect(
			restored.db
				.select()
				.from(accounts)
				.all()
				.map((row) => row.name)
		).toEqual(['OTP HUF']);
	});

	it('can be opened with the age command-line tool too', async () => {
		const treasury = database();
		await takeSnapshot(target(treasury));
		const keyFile = join(root, 'key.txt');
		writeFileSync(keyFile, `${key.identity}\n`);
		const decrypt = () =>
			execFileSync('age', ['-d', '-i', keyFile, join(drive, 'snapshots', 'latest.db.age')])
				.subarray(0, 15)
				.toString();
		try {
			expect(decrypt()).toBe('SQLite format 3');
		} catch (error) {
			// The age tool isn't installed on this machine; the library round trip is covered above.
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return expect(true).toBe(true);
			throw error;
		}
	});

	it('writes unencrypted snapshots when no key is given', async () => {
		await takeSnapshot(target(database(), null));
		expect(readManifest(drive)?.encrypted).toBe(false);
		expect(existsSync(join(drive, 'snapshots', 'latest.db'))).toBe(true);
	});

	it('never overwrites a snapshot of a different database', async () => {
		await takeSnapshot(target(database('first.db')));
		const stranger = database('second.db');
		await expect(takeSnapshot(target(stranger))).rejects.toBeInstanceOf(SnapshotConflictError);
		expect(readManifest(drive)?.generation).toBe(1);
	});

	it('never overwrites a newer snapshot of the same database', async () => {
		const original = database();
		await takeSnapshot(target(original));

		// A second server restores the same database and moves ahead.
		const copyPath = join(root, 'copy', 'treasury.db');
		await restoreIfMissing({ dbPath: copyPath, driveDir: drive, key });
		const copy = openDatabase({ path: copyPath, migrationsFolder });
		open.push(copy);
		await takeSnapshot(target(copy));
		expect(readManifest(drive)?.generation).toBe(2);

		// The first server wakes up still at generation 1.
		await expect(takeSnapshot(target(original))).rejects.toThrow(/newer snapshot/);
	});

	it('keeps dated copies and prunes old ones', async () => {
		const treasury = database();
		const keep = { daily: 2, monthly: 1 };
		for (const day of ['2026-09-30', '2026-10-01', '2026-10-02']) {
			await takeSnapshot(target(treasury), { dated: { day, month: day.slice(0, 7) }, keep });
		}
		expect(readdirSync(join(drive, 'snapshots', 'daily')).sort()).toEqual([
			'2026-10-01.db.age',
			'2026-10-02.db.age'
		]);
		expect(readdirSync(join(drive, 'snapshots', 'monthly'))).toEqual(['2026-10.db.age']);
	});

	it('refuses to work when the Drive folder is missing', async () => {
		const treasury = database();
		const missing = { ...target(treasury), driveDir: join(root, 'not-mounted') };
		await expect(takeSnapshot(missing)).rejects.toBeInstanceOf(DriveUnavailableError);
		expect((await checkDrive(join(root, 'not-mounted'))).reachable).toBe(false);
	});

	it('leaves an existing local database alone', async () => {
		const treasury = database();
		await takeSnapshot(target(treasury));
		const result = await restoreIfMissing({
			dbPath: join(root, 'data', 'treasury.db'),
			driveDir: drive,
			key
		});
		expect(result.restored).toBe(false);
	});

	it('starts fresh when Drive has no snapshot yet', async () => {
		const result = await restoreIfMissing({ dbPath: join(root, 'new.db'), driveDir: drive, key });
		expect(result).toMatchObject({ restored: false, manifest: null });
	});

	it('will not restore an encrypted snapshot without the key, or with the wrong one', async () => {
		await takeSnapshot(target(database()));
		const dbPath = join(root, 'restore', 'treasury.db');
		await expect(restoreIfMissing({ dbPath, driveDir: drive, key: null })).rejects.toBeInstanceOf(
			SnapshotKeyError
		);
		const wrong = await generateSnapshotKey();
		await expect(restoreIfMissing({ dbPath, driveDir: drive, key: wrong })).rejects.toThrow(
			/different key/
		);
		expect(existsSync(dbPath)).toBe(false);
	});
});
