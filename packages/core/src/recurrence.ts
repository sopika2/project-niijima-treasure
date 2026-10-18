import { isIsoDate } from './ledger.ts';

/**
 * When a recurring item happens. Stored as a small subset of an RFC 5545 rule, e.g.
 * "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1", so it stays readable in definitions.yml.
 */
export interface Schedule {
	readonly freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	/** Every N days/weeks/months/years. */
	readonly interval: number;
	/** Monthly only: day of the month, 1 to 31, or -1 for the last day. Short months use their last day. */
	readonly dayOfMonth?: number;
}

const FREQS = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' } as const;

export class ScheduleError extends Error {
	constructor(text: string) {
		super(`"${text}" is not a schedule this app understands.`);
		this.name = 'ScheduleError';
	}
}

export function parseSchedule(text: string): Schedule {
	const parts = new Map(
		text
			.split(';')
			.map((part) => part.split('='))
			.filter((pair): pair is [string, string] => pair.length === 2)
			.map(([key, value]) => [key.trim().toUpperCase(), value.trim().toUpperCase()])
	);
	const freq = FREQS[parts.get('FREQ') as keyof typeof FREQS];
	const interval = Number(parts.get('INTERVAL') ?? '1');
	if (!freq || !Number.isInteger(interval) || interval < 1 || interval > 366)
		throw new ScheduleError(text);
	if (freq !== 'monthly') return { freq, interval };
	const day = parts.has('BYMONTHDAY') ? Number(parts.get('BYMONTHDAY')) : undefined;
	if (day !== undefined && !(Number.isInteger(day) && (day === -1 || (day >= 1 && day <= 31)))) {
		throw new ScheduleError(text);
	}
	return day === undefined ? { freq, interval } : { freq, interval, dayOfMonth: day };
}

export function formatSchedule(schedule: Schedule): string {
	const parts = [`FREQ=${schedule.freq.toUpperCase()}`, `INTERVAL=${schedule.interval}`];
	if (schedule.freq === 'monthly' && schedule.dayOfMonth !== undefined) {
		parts.push(`BYMONTHDAY=${schedule.dayOfMonth}`);
	}
	return parts.join(';');
}

/* ── Plain calendar dates (no time zones involved) ─────────────────────── */

function toDays(date: string): number {
	return (
		Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) /
		86_400_000
	);
}

function fromDays(days: number): string {
	return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	return fromDays(toDays(date) + days);
}

export function daysBetween(from: string, to: string): number {
	return toDays(to) - toDays(from);
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The date of `day` in a month, clamped to that month's last day (31 → 30 or 28/29). */
function inMonth(year: number, month: number, day: number): string {
	const last = daysInMonth(year, month);
	const actual = day === -1 ? last : Math.min(day, last);
	return `${year}-${String(month).padStart(2, '0')}-${String(actual).padStart(2, '0')}`;
}

/**
 * Every date the schedule falls on between `from` and `to` (inclusive), counting from `start`
 * and stopping after `end` if given. Pure date math, safe for years ahead.
 */
export function occurrences(
	schedule: Schedule,
	start: string,
	from: string,
	to: string,
	end?: string | null,
	limit = 2000
): string[] {
	if (!isIsoDate(start) || !isIsoDate(from) || !isIsoDate(to)) return [];
	const last = end && end < to ? end : to;
	const dates: string[] = [];
	const push = (date: string) => {
		if (date >= start && date >= from && date <= last) dates.push(date);
	};

	if (schedule.freq === 'daily' || schedule.freq === 'weekly') {
		const step = schedule.interval * (schedule.freq === 'weekly' ? 7 : 1);
		const behind = Math.max(0, daysBetween(start, from));
		let day = toDays(start) + Math.ceil(behind / step) * step;
		while (fromDays(day) <= last && dates.length < limit) {
			push(fromDays(day));
			day += step;
		}
		return dates;
	}

	const startYear = Number(start.slice(0, 4));
	const startMonth = Number(start.slice(5, 7));
	const startDay = Number(start.slice(8, 10));
	const months = schedule.freq === 'yearly' ? 12 * schedule.interval : schedule.interval;
	const fromIndex =
		(Number(from.slice(0, 4)) - startYear) * 12 + Number(from.slice(5, 7)) - startMonth;
	let index = Math.max(0, Math.floor(fromIndex / months) * months);
	while (dates.length < limit) {
		const total = startMonth - 1 + index;
		const year = startYear + Math.floor(total / 12);
		const month = (total % 12) + 1;
		const day = schedule.freq === 'monthly' ? (schedule.dayOfMonth ?? startDay) : startDay;
		const date = inMonth(year, month, day);
		if (date > last) break;
		push(date);
		index += months;
	}
	return dates;
}

/** The first date on or after `after` the schedule falls on, or null if it has ended. */
export function nextOccurrence(
	schedule: Schedule,
	start: string,
	after: string,
	end?: string | null
): string | null {
	const horizon = addDays(after, 366 * schedule.interval + 31);
	return occurrences(schedule, start, after, horizon, end, 1)[0] ?? null;
}

/** How often per month on average, for "monthly cost" figures. */
export function perMonth(schedule: Schedule): number {
	switch (schedule.freq) {
		case 'daily':
			return 30.44 / schedule.interval;
		case 'weekly':
			return 30.44 / 7 / schedule.interval;
		case 'monthly':
			return 1 / schedule.interval;
		case 'yearly':
			return 1 / 12 / schedule.interval;
	}
}
