import {
	checkDrive,
	DriveUnavailableError,
	getSetting,
	readManifest,
	SnapshotConflictError,
	SnapshotScheduler,
	takeSnapshot,
	totalChanges,
	type DriveStatus,
	type Manifest,
	type SnapshotKey,
	type Treasury
} from '@treasure/db';
import { log, logError } from './log.ts';

export type SnapshotStateName = 'saved' | 'pending' | 'never' | 'off' | 'blocked';

export interface SnapshotStatus {
	readonly state: SnapshotStateName;
	readonly lastSavedAt: string | null;
	readonly generation: number;
	readonly encrypted: boolean;
	readonly problem: string | null;
}

export interface SnapshotSettings {
	readonly treasury: Treasury;
	readonly driveDir: string;
	readonly workDir: string;
	readonly key: SnapshotKey | null;
	/** Why snapshots are switched off, or null when they run. */
	readonly disabledReason: string | null;
	readonly delayMinutes: number;
	readonly keep: { readonly daily: number; readonly monthly: number };
	readonly timezone: string;
	readonly appVersion: string;
	/** Text files mirrored to Drive with every snapshot (config.yml). */
	readonly extras: () => Record<string, string>;
}

/** Local calendar day and month in the configured time zone, for dated snapshot names. */
export function localDay(timezone: string, at = new Date()): { day: string; month: string } {
	const day = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(at);
	return { day, month: day.slice(0, 7) };
}

/** Keeps the Drive copy of the database current: shortly after changes, nightly, and on shutdown. */
export class SnapshotService {
	readonly #settings: SnapshotSettings;
	readonly #scheduler: SnapshotScheduler | null;
	#lastSavedAt: string | null = null;
	#blocked: string | null = null;

	constructor(settings: SnapshotSettings) {
		this.#settings = settings;
		const manifest = readManifestSafely(settings.driveDir);
		const generation = this.generation();
		const upToDate =
			manifest !== null &&
			manifest.instance_id === settings.treasury.instanceId &&
			manifest.generation === generation;
		if (upToDate) this.#lastSavedAt = manifest.taken_at;

		this.#scheduler = settings.disabledReason
			? null
			: new SnapshotScheduler(
					{
						changes: () => totalChanges(settings.treasury.sqlite),
						run: () => this.#take(),
						delayMs: settings.delayMinutes * 60_000,
						onError: (error) => logError('snapshot', error)
					},
					upToDate
				);
	}

	start(): void {
		this.#scheduler?.start();
		if (this.#settings.disabledReason) log('snapshot', `off: ${this.#settings.disabledReason}`);
	}

	stop(): void {
		this.#scheduler?.stop();
	}

	generation(): number {
		return getSetting<number>(this.#settings.treasury.db, 'snapshot_generation') ?? 0;
	}

	async #take(dated = false): Promise<number> {
		const s = this.#settings;
		try {
			const result = await takeSnapshot(
				{
					treasury: s.treasury,
					driveDir: s.driveDir,
					workDir: s.workDir,
					key: s.key,
					appVersion: s.appVersion
				},
				{
					extras: s.extras(),
					...(dated ? { dated: localDay(s.timezone), keep: s.keep } : {})
				}
			);
			this.#lastSavedAt = result.manifest.taken_at;
			this.#blocked = null;
			const pruned = result.pruned.length ? `, removed ${result.pruned.length} old copies` : '';
			log(
				'snapshot',
				`saved generation ${result.manifest.generation} to Drive${dated ? ' (nightly)' : ''}${pruned}`
			);
			return result.changesAfter;
		} catch (error) {
			if (error instanceof SnapshotConflictError || error instanceof DriveUnavailableError) {
				this.#blocked = error.message;
			}
			throw error;
		}
	}

	/** The "snapshot now" button. */
	async now(): Promise<void> {
		if (!this.#scheduler) throw new Error(this.#settings.disabledReason ?? 'Snapshots are off.');
		const before = this.#lastSavedAt;
		await this.#scheduler.flush(true);
		if (this.#lastSavedAt === before) {
			throw new Error(this.#scheduler.state().lastError ?? 'The snapshot was not saved.');
		}
	}

	/** The nightly run: a fresh snapshot plus dated daily and monthly copies. */
	async nightly(): Promise<void> {
		if (!this.#scheduler) return;
		try {
			this.#scheduler.markSaved(await this.#take(true));
		} catch (error) {
			logError('snapshot', error);
		}
	}

	/** Called on shutdown so the last edits reach Drive. */
	async flush(): Promise<void> {
		await this.#scheduler?.flush();
	}

	status(): SnapshotStatus {
		const base = {
			lastSavedAt: this.#lastSavedAt,
			generation: this.generation(),
			encrypted: this.#settings.key !== null
		};
		if (!this.#scheduler) {
			return { ...base, state: 'off', problem: this.#settings.disabledReason };
		}
		const scheduler = this.#scheduler.state();
		if (this.#blocked) return { ...base, state: 'blocked', problem: this.#blocked };
		if (scheduler.pending) {
			return {
				...base,
				state: this.#lastSavedAt ? 'pending' : 'never',
				problem: scheduler.lastError
			};
		}
		return { ...base, state: this.#lastSavedAt ? 'saved' : 'never', problem: null };
	}

	drive(): Promise<DriveStatus> {
		return checkDrive(this.#settings.driveDir);
	}

	manifest(): Manifest | null {
		return readManifestSafely(this.#settings.driveDir);
	}
}

function readManifestSafely(driveDir: string): Manifest | null {
	try {
		return readManifest(driveDir);
	} catch {
		return null;
	}
}
