import { accountBalances, monthlyTotals, spendingByCategory, trackingStart } from '@treasure/db';
import { addDays } from '@treasure/core';
import {
	categoryOption,
	lookup,
	monthRange,
	shiftMonth,
	toBase,
	today
} from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const app = await runtime();
	const { db } = app.treasury;
	const span = url.searchParams.get('months') === '12' ? 12 : 6;
	const { day, month } = today(app);
	// Months before tracking began would show as zero months and drag every average down.
	const started = trackingStart(db);
	const spanStart = monthRange(shiftMonth(month, -(span - 1))).from;
	const from = started && started > spanStart ? monthRange(started.slice(0, 7)).from : spanStart;
	const to = day;

	const months = monthlyTotals(db, from, to);

	// The combined balance at the end of each month (today for this month), in the base currency.
	const netWorth = months.map(({ month: which }) => {
		const end = which === month ? day : monthRange(which).to;
		let total = 0;
		for (const { account, balanceMinor } of accountBalances(db, {
			asOf: end,
			includeArchived: true
		})) {
			if (!account.includeInTotal) continue;
			total += toBase(app, balanceMinor, account.currency, end) ?? 0;
		}
		return { date: end, value: total };
	});
	// Start the line at the day before the first month so it has a visible beginning, or on
	// the day tracking began when that was later.
	const startBalance = (() => {
		const before = started && started > addDays(from, -1) ? started : addDays(from, -1);
		let total = 0;
		for (const { account, balanceMinor } of accountBalances(db, {
			asOf: before,
			includeArchived: true
		})) {
			if (account.includeInTotal) total += toBase(app, balanceMinor, account.currency, before) ?? 0;
		}
		return { date: before, value: total };
	})();

	const { categories } = lookup(app);
	const spending = spendingByCategory(db, from, to);
	const spent = spending.reduce((sum, row) => sum + row.amountMinor, 0);
	const byCategory = spending.map((row) => {
		const category = row.categoryId ? categories.get(row.categoryId) : undefined;
		return {
			id: row.categoryId ?? 'none',
			name: category?.name ?? null,
			color: category ? categoryOption(category).color : 8,
			amount: row.amountMinor,
			count: row.count,
			share: spent > 0 ? row.amountMinor / spent : 0
		};
	});

	const income = months.reduce((sum, row) => sum + row.incomeMinor, 0);
	// An average month leaves out the month still running, unless it's the only one there is.
	const complete = months.length > 1 ? months.filter((row) => row.month !== month) : months;
	const average = (pick: (row: (typeof months)[number]) => number) =>
		Math.round(complete.reduce((sum, row) => sum + pick(row), 0) / Math.max(1, complete.length));
	return {
		span,
		from,
		to,
		months,
		netWorth: [startBalance, ...netWorth],
		byCategory,
		totals: {
			income,
			spent,
			averageIncome: average((row) => row.incomeMinor),
			averageSpent: average((row) => row.expenseMinor),
			missingRates: months.reduce((sum, row) => sum + row.missingRates, 0)
		}
	};
};
