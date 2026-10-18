import { addDays, projectBalance, type Projection, type ProjectionEvent } from '@treasure/core';
import { averageDailySpend } from '@treasure/db';
import { today } from './ledger.ts';
import { upcomingEvents } from './recurring.ts';
import type { Runtime } from './runtime.ts';
import { statsReader } from './stats.ts';

export interface ProjectionResult extends Projection {
	/** Everyday spending assumed per day, base currency, minor units. */
	readonly dailySpendMinor: number;
	readonly basis: 'average' | 'fixed';
	readonly months: number;
}

/** Everyday spending per day: the recent average, or the fixed figure from config.yml. */
export function dailySpend(app: Runtime): {
	perDay: number;
	basis: 'average' | 'fixed';
	months: number;
} {
	const setting = app.config.projection.everyday_spending;
	if (setting.mode === 'fixed') {
		return { perDay: (setting.per_month * 100) / 30.44, basis: 'fixed', months: 0 };
	}
	const day = today(app).day;
	const from = addDays(day, -Math.round(setting.months * 30.44));
	return {
		perDay: averageDailySpend(app.treasury.db, from, day),
		basis: 'average',
		months: setting.months
	};
}

/**
 * The balance from today to `days` ahead: today's total, every known recurring item and
 * waiting confirmation on its date, and everyday spending spread over each day. `extra` adds
 * what-if events that are not saved.
 */
export async function projection(
	app: Runtime,
	days = Math.round(app.config.projection.horizon_months * 30.44),
	extra: readonly ProjectionEvent[] = []
): Promise<ProjectionResult> {
	const day = today(app).day;
	const until = addDays(day, days);
	const { total } = await statsReader(app).accounts();
	const spend = dailySpend(app);
	const result = projectBalance({
		today: day,
		until,
		startMinor: total.amount,
		events: [...upcomingEvents(app, until), ...extra],
		dailySpendMinor: spend.perDay
	});
	return {
		...result,
		dailySpendMinor: Math.round(spend.perDay),
		basis: spend.basis,
		months: spend.months
	};
}
