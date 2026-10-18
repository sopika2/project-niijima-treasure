import { describe, expect, it } from 'vitest';
import { budgetStatus, goalStatus } from './plans.ts';
import { projectBalance } from './projection.ts';
import {
	formatSchedule,
	nextOccurrence,
	occurrences,
	parseSchedule,
	ScheduleError
} from './recurrence.ts';

describe('schedules', () => {
	it('round-trips the stored text', () => {
		const schedule = parseSchedule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31');
		expect(schedule).toEqual({ freq: 'monthly', interval: 1, dayOfMonth: 31 });
		expect(formatSchedule(schedule)).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31');
		expect(() => parseSchedule('FREQ=HOURLY')).toThrow(ScheduleError);
		expect(() => parseSchedule('FREQ=MONTHLY;BYMONTHDAY=40')).toThrow(ScheduleError);
	});

	it('puts day 31 on the last day of short months', () => {
		const monthly = parseSchedule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31');
		expect(occurrences(monthly, '2026-01-01', '2026-01-01', '2026-04-30')).toEqual([
			'2026-01-31',
			'2026-02-28',
			'2026-03-31',
			'2026-04-30'
		]);
	});

	it('skips dates before the start and after the end', () => {
		const first = parseSchedule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1');
		expect(occurrences(first, '2026-10-18', '2026-10-01', '2027-01-31', '2026-12-15')).toEqual([
			'2026-11-01',
			'2026-12-01'
		]);
	});

	it('handles weekly, every N days, every 2 months and yearly', () => {
		expect(
			occurrences({ freq: 'weekly', interval: 2 }, '2026-10-05', '2026-10-10', '2026-11-10')
		).toEqual(['2026-10-19', '2026-11-02']);
		expect(
			occurrences({ freq: 'daily', interval: 10 }, '2026-10-01', '2026-10-01', '2026-10-25')
		).toEqual(['2026-10-01', '2026-10-11', '2026-10-21']);
		expect(
			occurrences({ freq: 'monthly', interval: 2 }, '2026-01-15', '2026-02-01', '2026-07-31')
		).toEqual(['2026-03-15', '2026-05-15', '2026-07-15']);
		expect(
			occurrences({ freq: 'yearly', interval: 1 }, '2024-02-29', '2025-01-01', '2028-12-31')
		).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
		expect(
			nextOccurrence({ freq: 'monthly', interval: 1, dayOfMonth: 5 }, '2026-01-05', '2026-10-06')
		).toBe('2026-11-05');
	});
});

describe('projectBalance', () => {
	it('adds events on their dates and spreads everyday spending exactly', () => {
		const projection = projectBalance({
			today: '2026-10-18',
			until: '2026-10-21',
			startMinor: 100_000,
			dailySpendMinor: 1000.5,
			events: [
				{ date: '2026-10-10', amountMinor: -5000, label: 'late bill' },
				{ date: '2026-10-20', amountMinor: -60_000, label: 'rent' },
				{ date: '2026-12-01', amountMinor: 1, label: 'too far' }
			]
		});
		expect(projection.points.map((point) => point.balanceMinor)).toEqual([
			95_000, 93_999, 32_999, 31_998
		]);
		expect(projection.lowest).toMatchObject({ date: '2026-10-21', balanceMinor: 31_998 });
		expect(projection.points[2]?.events.map((event) => event.label)).toEqual(['rent']);
	});
});

describe('budgetStatus', () => {
	const base = { limitMinor: 30_000_00, month: '2026-10', warnAt: 0.8 };
	it('flags pace, warning and over', () => {
		expect(budgetStatus({ ...base, spentMinor: 5_000_00, today: '2026-10-15' }).state).toBe('ok');
		expect(budgetStatus({ ...base, spentMinor: 18_000_00, today: '2026-10-15' }).state).toBe(
			'pace'
		);
		expect(budgetStatus({ ...base, spentMinor: 25_000_00, today: '2026-10-15' }).state).toBe(
			'warn'
		);
		expect(budgetStatus({ ...base, spentMinor: 31_000_00, today: '2026-10-15' }).state).toBe(
			'over'
		);
		expect(
			budgetStatus({ ...base, spentMinor: 18_000_00, today: '2026-10-15' }).projectedMinor
		).toBe(37_200_00);
	});
});

describe('goalStatus', () => {
	it('works out the monthly need and the finish date', () => {
		const status = goalStatus({
			targetMinor: 300_000_00,
			savedMinor: 120_000_00,
			today: '2026-10-18',
			deadline: '2027-04-18',
			recentPerMonthMinor: 20_000_00
		});
		expect(status.progress).toBeCloseTo(0.4);
		expect(status.neededPerMonthMinor).toBe(Math.ceil(180_000_00 / (182 / 30.44)));
		expect(status.projectedDate).toBe('2027-07-19'); // 9 months of 30.44 days
		expect(status.late).toBe(true);
		expect(
			goalStatus({
				targetMinor: 100,
				savedMinor: 150,
				today: '2026-10-18',
				deadline: null,
				recentPerMonthMinor: 0
			}).reached
		).toBe(true);
	});
});
