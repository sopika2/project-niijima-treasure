/**
 * Decides when to write a snapshot: after the database has changed and then stayed quiet for
 * `delayMs`. A burst of edits becomes one snapshot, and at most `delayMs` of work is ever at risk.
 */
export interface SchedulerOptions {
	/** Current value of the database's change counter. */
	readonly changes: () => number;
	/** Writes the snapshot and returns the change counter right after it. */
	readonly run: () => Promise<number>;
	readonly delayMs: number;
	readonly now?: () => number;
	readonly onError?: (error: unknown) => void;
}

export interface SchedulerState {
	readonly pending: boolean;
	readonly running: boolean;
	readonly lastChangeAt: number | null;
	readonly lastSavedAt: number | null;
	readonly lastError: string | null;
}

export class SnapshotScheduler {
	readonly #options: SchedulerOptions;
	readonly #now: () => number;
	#seen: number;
	#saved: number;
	#lastChangeAt: number | null = null;
	#lastSavedAt: number | null = null;
	#lastError: string | null = null;
	#running: Promise<void> | null = null;
	#timer: ReturnType<typeof setInterval> | null = null;

	constructor(options: SchedulerOptions, alreadySaved = false) {
		this.#options = options;
		this.#now = options.now ?? Date.now;
		this.#seen = options.changes();
		// A freshly opened database (migrations, first run) counts as unsaved unless told otherwise.
		this.#saved = alreadySaved ? this.#seen : -1;
		if (!alreadySaved) this.#lastChangeAt = this.#now();
	}

	state(): SchedulerState {
		return {
			pending: this.#saved !== this.#seen,
			running: this.#running !== null,
			lastChangeAt: this.#lastChangeAt,
			lastSavedAt: this.#lastSavedAt,
			lastError: this.#lastError
		};
	}

	/** Checks for changes and snapshots if they have been quiet long enough. */
	async tick(): Promise<void> {
		const changes = this.#options.changes();
		if (changes !== this.#seen) {
			this.#seen = changes;
			this.#lastChangeAt = this.#now();
		}
		const quietFor = this.#now() - (this.#lastChangeAt ?? 0);
		if (this.#saved !== this.#seen && quietFor >= this.#options.delayMs) await this.#save();
	}

	/** Snapshot now if anything is unsaved (used on shutdown and by the "snapshot now" button). */
	async flush(force = false): Promise<void> {
		this.#seen = this.#options.changes();
		if (force || this.#saved !== this.#seen) await this.#save();
	}

	/** Record a snapshot taken elsewhere (e.g. the nightly job). */
	markSaved(changesAfter: number): void {
		this.#seen = changesAfter;
		this.#saved = changesAfter;
		this.#lastSavedAt = this.#now();
		this.#lastError = null;
	}

	start(intervalMs = 15_000): void {
		this.stop();
		this.#timer = setInterval(() => void this.tick(), intervalMs);
		this.#timer.unref?.();
	}

	stop(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
	}

	async #save(): Promise<void> {
		if (this.#running) return this.#running;
		this.#running = (async () => {
			try {
				this.markSaved(await this.#options.run());
			} catch (error) {
				this.#lastError = error instanceof Error ? error.message : String(error);
				// Wait a full delay before retrying instead of retrying on every tick.
				this.#lastChangeAt = this.#now();
				this.#options.onError?.(error);
			} finally {
				this.#running = null;
			}
		})();
		return this.#running;
	}
}
