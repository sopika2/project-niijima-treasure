import {
	addDays,
	budgetStatus,
	goalStatus,
	type BudgetStatus,
	type GoalStatus
} from '@treasure/core';
import {
	accountBalances,
	budgetsForMonth,
	contributionTotals,
	listCategories,
	listGoals,
	spendingByCategory
} from '@treasure/db';
import { categoryOption, monthRange, toBase, today } from './ledger.ts';
import type { Runtime } from './runtime.ts';

export interface BudgetRow extends BudgetStatus {
	readonly categoryId: string;
	readonly name: string;
	readonly color: number;
	readonly limitMinor: number;
	readonly spentMinor: number;
	readonly currency: string;
	/** True when this month has its own limit instead of the default. */
	readonly override: boolean;
}

/** Every category that has a limit, with this month's spending against it, biggest share first. */
export function budgetRows(app: Runtime, month = today(app).month): BudgetRow[] {
	const { db } = app.treasury;
	const day = today(app).day;
	const { from, to } = monthRange(month);
	const spent = new Map(
		spendingByCategory(db, from, to).map((row) => [row.categoryId, row.amountMinor])
	);
	const categories = new Map(
		listCategories(db, { includeArchived: true }).map((row) => [row.id, row])
	);
	const warnAt = app.config.alerts.budget_warn_percent / 100;
	return budgetsForMonth(db, month)
		.map((budget) => {
			const category = categories.get(budget.categoryId);
			const spentMinor = spent.get(budget.categoryId) ?? 0;
			return {
				categoryId: budget.categoryId,
				name: category?.name ?? '?',
				color: category ? categoryOption(category).color : 8,
				limitMinor: budget.limitMinor,
				spentMinor,
				currency: budget.currency,
				override: budget.month !== null,
				...budgetStatus({ limitMinor: budget.limitMinor, spentMinor, month, today: day, warnAt })
			};
		})
		.sort((a, b) => b.used - a.used);
}

export interface GoalRow extends GoalStatus {
	readonly id: string;
	readonly name: string;
	readonly targetMinor: number;
	readonly savedMinor: number;
	readonly currency: string;
	readonly deadline: string | null;
	readonly accountId: string | null;
	readonly accountName: string | null;
	readonly recentPerMonthMinor: number;
	readonly archived: boolean;
}

const LOOKBACK_DAYS = 90;
/** Shortest span a pace is measured over, so one deposit in the first days isn't read as a habit. */
const MIN_PACE_DAYS = 14;
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Every Treasure with its progress. A Treasure tied to an account counts that account's balance
 * (and its growth over the last 90 days as the pace); otherwise it counts what was put in by hand.
 */
export function goalRows(app: Runtime, options: { includeArchived?: boolean } = {}): GoalRow[] {
	const { db } = app.treasury;
	const day = today(app).day;
	const since = addDays(day, -LOOKBACK_DAYS);
	const now = new Map(
		accountBalances(db, { asOf: day, includeArchived: true }).map((row) => [row.account.id, row])
	);
	const before = new Map(
		accountBalances(db, { asOf: since, includeArchived: true }).map((row) => [
			row.account.id,
			row.balanceMinor
		])
	);
	return listGoals(db, options).map((goal) => {
		let saved: number;
		let recent: number;
		let days = LOOKBACK_DAYS;
		const linked = goal.accountId ? now.get(goal.accountId) : undefined;
		if (linked) {
			const inGoalCurrency = (amount: number) =>
				linked.account.currency === goal.currency
					? amount
					: (toBase(app, amount, linked.account.currency) ?? 0);
			saved = inGoalCurrency(linked.balanceMinor);
			// An account opened within the lookback grew from its starting balance, not from 0:
			// counting from 0 would read the whole starting balance as recent saving.
			const { openingDate, openingBalanceMinor } = linked.account;
			if (openingDate > since) {
				recent = inGoalCurrency(linked.balanceMinor - openingBalanceMinor);
				days = Math.max(MIN_PACE_DAYS, daysBetween(openingDate, day));
			} else {
				recent = inGoalCurrency(linked.balanceMinor - (before.get(linked.account.id) ?? 0));
			}
		} else {
			const totals = contributionTotals(db, goal.id, since);
			saved = totals.total;
			recent = totals.recent;
		}
		const recentPerMonthMinor = Math.max(0, Math.round((recent / days) * 30.44));
		return {
			id: goal.id,
			name: goal.name,
			targetMinor: goal.targetMinor,
			savedMinor: saved,
			currency: goal.currency,
			deadline: goal.deadline,
			accountId: goal.accountId,
			accountName: linked?.account.name ?? null,
			recentPerMonthMinor,
			archived: goal.archived,
			...goalStatus({
				targetMinor: goal.targetMinor,
				savedMinor: saved,
				today: day,
				deadline: goal.deadline,
				recentPerMonthMinor
			})
		};
	});
}
