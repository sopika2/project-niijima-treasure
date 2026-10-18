import { describe, expect, it } from 'vitest';
import { SnapshotScheduler } from './scheduler.ts';

function setup(alreadySaved = true) {
	let clock = 0;
	let changes = 10;
	const runs: number[] = [];
	const scheduler = new SnapshotScheduler(
		{
			changes: () => changes,
			run: async () => {
				runs.push(clock);
				changes += 1; // the snapshot bumps its generation counter
				return changes;
			},
			delayMs: 120_000,
			now: () => clock
		},
		alreadySaved
	);
	return {
		scheduler,
		runs,
		edit: () => (changes += 1),
		advance: (ms: number) => (clock += ms)
	};
}

describe('SnapshotScheduler', () => {
	it('waits until edits have been quiet for the delay', async () => {
		const { scheduler, runs, edit, advance } = setup();
		edit();
		await scheduler.tick();
		advance(60_000);
		edit();
		await scheduler.tick();
		advance(90_000);
		await scheduler.tick();
		expect(runs).toEqual([]);
		advance(30_000);
		await scheduler.tick();
		expect(runs).toEqual([180_000]);
		expect(scheduler.state().pending).toBe(false);
	});

	it('does not snapshot again because of its own write', async () => {
		const { scheduler, runs, edit, advance } = setup();
		edit();
		await scheduler.tick();
		advance(120_000);
		await scheduler.tick();
		advance(600_000);
		await scheduler.tick();
		expect(runs).toHaveLength(1);
	});

	it('treats a freshly opened database as unsaved', async () => {
		const { scheduler, runs, advance } = setup(false);
		expect(scheduler.state().pending).toBe(true);
		advance(120_000);
		await scheduler.tick();
		expect(runs).toHaveLength(1);
	});

	it('backs off for a full delay after a failure', async () => {
		let clock = 0;
		let attempts = 0;
		const scheduler = new SnapshotScheduler({
			changes: () => 1,
			run: async () => {
				attempts += 1;
				throw new Error('Drive is down');
			},
			delayMs: 1_000,
			now: () => clock
		});
		clock = 1_000;
		await scheduler.tick();
		clock = 1_500;
		await scheduler.tick();
		expect(attempts).toBe(1);
		expect(scheduler.state().lastError).toBe('Drive is down');
		clock = 2_000;
		await scheduler.tick();
		expect(attempts).toBe(2);
	});

	it('flushes pending work on demand', async () => {
		const { scheduler, runs, edit } = setup();
		await scheduler.flush();
		expect(runs).toHaveLength(0);
		edit();
		await scheduler.flush();
		expect(runs).toHaveLength(1);
	});
});
