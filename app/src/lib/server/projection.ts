import { addDays, projectBalance, type Projection, type ProjectionEvent } from '@treasure/core';
import { averageDailySpend, trackingStart, type Scope } from '@treasure/db';
import { today } from './ledger.ts';
import { upcomingEvents } from './recurring.ts';
import type { Runtime } from './runtime.ts';
import { statsReader } from './stats.ts';

export interface ProjectionResult extends Projection {
	/** Everyday spending assumed per day, base currency, minor units. */
	readonly dailySpendMinor: number;
	readonly basis: 'average' | 'fixed';
	readonly months: number;
	/** Set when tracking began inside the averaging window: the days the average covers. */
	readonly days: number | null;
}

/** Shortest span the average covers, so one big shop in the first days isn't read as a habit. */
const MIN_DAYS = 7;

/** Everyday spending per day: the recent average, or the fixed figure from config.yml. */
export function dailySpend(
	app: Runtime,
	scope?: Scope
): {
	perDay: number;
	basis: 'average' | 'fixed';
	months: number;
	days: number | null;
} {
	const setting = app.config.projection.everyday_spending;
	if (setting.mode === 'fixed') {
		return { perDay: (setting.per_month * 100) / 30.44, basis: 'fixed', months: 0, days: null };
	}
	const day = today(app).day;
	const windowStart = addDays(day, -Math.round(setting.months * 30.44) + 1);
	// Days before tracking began aren't zero-spending days; averaging over them would make
	// the forecast look better than it is for the first months.
	const started = trackingStart(app.treasury.db, scope);
	const shortened = started !== null && started > windowStart;
	const from = shortened ? minDate(started, addDays(day, -(MIN_DAYS - 1))) : windowStart;
	return {
		perDay: averageDailySpend(app.treasury.db, from, day, scope),
		basis: 'average',
		months: setting.months,
		days: shortened ? daysBetween(from, day) + 1 : null
	};
}

const minDate = (a: string, b: string) => (a < b ? a : b);
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * The balance from today to `days` ahead: today's total, every known recurring item and
 * waiting confirmation on its date, and everyday spending spread over each day. `extra` adds
 * what-if events that are not saved.
 */
export async function projection(
	app: Runtime,
	days = Math.round(app.config.projection.horizon_months * 30.44),
	extra: readonly ProjectionEvent[] = [],
	scope?: Scope
): Promise<ProjectionResult> {
	const day = today(app).day;
	const until = addDays(day, days);
	const { total } = await statsReader(app, scope).accounts();
	const spend = dailySpend(app, scope);
	const result = projectBalance({
		today: day,
		until,
		startMinor: total.amount,
		events: [...upcomingEvents(app, until, scope), ...extra],
		dailySpendMinor: spend.perDay
	});
	return {
		...result,
		dailySpendMinor: Math.round(spend.perDay),
		basis: spend.basis,
		months: spend.months,
		days: spend.days
	};
}
