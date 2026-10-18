import { addDays, daysBetween, daysInMonth } from './recurrence.ts';

export type BudgetState = 'ok' | 'pace' | 'warn' | 'over';

export interface BudgetStatus {
	/** Spent as a share of the limit, 0 and up (1 = exactly at the limit). */
	readonly used: number;
	readonly remainingMinor: number;
	/** Where spending would land by month end at the current pace. */
	readonly projectedMinor: number;
	/** How much "should" be spent by today if spending were even across the month. */
	readonly expectedByTodayMinor: number;
	readonly state: BudgetState;
}

/**
 * A monthly budget's standing. `over` once the limit is passed, `warn` past the warning
 * share, `pace` when spending so far would pass the limit by month end, otherwise `ok`.
 */
export function budgetStatus(input: {
	readonly limitMinor: number;
	readonly spentMinor: number;
	/** YYYY-MM */
	readonly month: string;
	/** YYYY-MM-DD */
	readonly today: string;
	/** e.g. 0.8 */
	readonly warnAt: number;
}): BudgetStatus {
	const [year, month] = input.month.split('-').map(Number) as [number, number];
	const length = daysInMonth(year, month);
	const currentMonth = input.today.slice(0, 7);
	const elapsed =
		input.month < currentMonth
			? length
			: input.month > currentMonth
				? 0
				: Number(input.today.slice(8, 10));
	const used = input.limitMinor > 0 ? input.spentMinor / input.limitMinor : 0;
	const projectedMinor = elapsed > 0 ? Math.round((input.spentMinor / elapsed) * length) : 0;
	const expectedByTodayMinor = Math.round((input.limitMinor * elapsed) / length);
	let state: BudgetState = 'ok';
	if (input.spentMinor > input.limitMinor) state = 'over';
	else if (used >= input.warnAt) state = 'warn';
	else if (elapsed >= 5 && elapsed < length && projectedMinor > input.limitMinor) state = 'pace';
	return {
		used,
		remainingMinor: input.limitMinor - input.spentMinor,
		projectedMinor,
		expectedByTodayMinor,
		state
	};
}

export interface GoalStatus {
	/** 0 to 1 */
	readonly progress: number;
	readonly remainingMinor: number;
	/** What to put aside per month to make the deadline; null without a deadline or when done. */
	readonly neededPerMonthMinor: number | null;
	/** When it will be reached at the recent saving pace; null when not saving or already done. */
	readonly projectedDate: string | null;
	readonly reached: boolean;
	readonly late: boolean;
}

/**
 * A savings goal's standing. `recentPerMonthMinor` is how much went towards it per month lately
 * (from contributions, or the linked account's growth).
 */
export function goalStatus(input: {
	readonly targetMinor: number;
	readonly savedMinor: number;
	readonly today: string;
	readonly deadline: string | null;
	readonly recentPerMonthMinor: number;
}): GoalStatus {
	const remainingMinor = Math.max(0, input.targetMinor - input.savedMinor);
	const reached = remainingMinor === 0;
	const progress =
		input.targetMinor > 0 ? Math.min(1, Math.max(0, input.savedMinor / input.targetMinor)) : 0;
	let neededPerMonthMinor: number | null = null;
	if (!reached && input.deadline) {
		const months = Math.max(daysBetween(input.today, input.deadline) / 30.44, 0);
		neededPerMonthMinor = months >= 1 ? Math.ceil(remainingMinor / months) : remainingMinor;
	}
	let projectedDate: string | null = null;
	if (!reached && input.recentPerMonthMinor > 0) {
		const days = Math.ceil((remainingMinor / input.recentPerMonthMinor) * 30.44);
		projectedDate = days < 365 * 50 ? addDays(input.today, days) : null;
	}
	const late =
		!reached &&
		!!input.deadline &&
		(input.deadline < input.today ||
			(projectedDate !== null ? projectedDate > input.deadline : input.recentPerMonthMinor <= 0));
	return { progress, remainingMinor, neededPerMonthMinor, projectedDate, reached, late };
}
