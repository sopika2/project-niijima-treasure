import {
	constants,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Layout of the app's folder on Google Drive (Niijima-network/Treasure/):
 *
 *   config.yml          copy of the server's config.yml
 *   definitions.yml     readable export of accounts, categories, rules, budgets, treasures
 *   snapshots/
 *     latest.db.age     the most recent encrypted database snapshot
 *     latest.json       what latest.db.age is: when, which database, which generation
 *     daily/YYYY-MM-DD.db.age
 *     monthly/YYYY-MM.db.age
 *   exports/            monthly CSV and JSON exports (later milestone)
 *   rates/              exchange-rate history (later milestone)
 */
export const driveLayout = (root: string) => ({
	root,
	config: join(root, 'config.yml'),
	definitions: join(root, 'definitions.yml'),
	snapshots: join(root, 'snapshots'),
	manifest: join(root, 'snapshots', 'latest.json'),
	latest: (encrypted: boolean) =>
		join(root, 'snapshots', encrypted ? 'latest.db.age' : 'latest.db'),
	daily: join(root, 'snapshots', 'daily'),
	monthly: join(root, 'snapshots', 'monthly'),
	exports: join(root, 'exports'),
	rates: join(root, 'rates')
});

export class DriveUnavailableError extends Error {
	constructor(root: string, detail: string) {
		super(
			`The Drive folder ${root} is not reachable (${detail}). ` +
				'Check that the rclone mount is running and the folder is mounted into the container.'
		);
		this.name = 'DriveUnavailableError';
	}
}

export interface DriveStatus {
	readonly reachable: boolean;
	readonly writable: boolean;
	readonly detail: string | null;
}

/** The folder must already exist: the app never creates it, so a dead mount is never mistaken for an empty Drive. */
export async function checkDrive(root: string): Promise<DriveStatus> {
	try {
		if (!statSync(root).isDirectory()) {
			return { reachable: false, writable: false, detail: 'not a folder' };
		}
	} catch {
		return { reachable: false, writable: false, detail: 'folder does not exist' };
	}
	try {
		await access(root, constants.W_OK);
		return { reachable: true, writable: true, detail: null };
	} catch {
		return { reachable: true, writable: false, detail: 'folder is read-only for the app' };
	}
}

export async function requireDrive(root: string): Promise<void> {
	const status = await checkDrive(root);
	if (!status.reachable || !status.writable) {
		throw new DriveUnavailableError(root, status.detail ?? 'unknown');
	}
}

/**
 * Writes a whole file in one go: to a temporary name first, then renamed into place, so a
 * half-written file is never mistaken for a good one (important on an rclone mount).
 */
export function writeFileAtomic(path: string, data: Uint8Array | string): void {
	mkdirSync(dirname(path), { recursive: true });
	const partial = `${path}.partial`;
	writeFileSync(partial, data);
	renameSync(partial, path);
}

export function removeIfExists(path: string): void {
	if (existsSync(path)) rmSync(path, { force: true });
}
