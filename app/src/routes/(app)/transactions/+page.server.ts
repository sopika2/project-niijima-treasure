import { fail } from '@sveltejs/kit';
import { planTransaction, transactionKinds, type TransactionKind } from '@treasure/core';
import { createTransaction, listTransactions, periodTotals } from '@treasure/db';
import {
	fieldErrors,
	isMonth,
	ledgerContext,
	lookup,
	monthRange,
	scopeOf,
	shiftMonth,
	text,
	today,
	transactionRow
} from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const app = await runtime();
	const { db } = app.treasury;
	const scope = scopeOf(locals);
	const current = today(app).month;
	const month = isMonth(url.searchParams.get('month')) ? url.searchParams.get('month')! : current;
	const { from, to } = monthRange(month);
	const kindParam = url.searchParams.get('kind');
	const kind = transactionKinds.find((value) => value === kindParam) as TransactionKind | undefined;
	const filters = {
		account: url.searchParams.get('account') ?? '',
		category: url.searchParams.get('category') ?? '',
		kind: kind ?? '',
		q: (url.searchParams.get('q') ?? '').slice(0, 80)
	};

	const { accounts, categories } = lookup(app);
	const rows = listTransactions(db, {
		status: 'posted',
		from,
		to,
		accountId: filters.account || undefined,
		categoryId: filters.category || undefined,
		kind,
		search: filters.q || undefined,
		scope
	}).map((row) => transactionRow(row, accounts, categories));

	return {
		month,
		isCurrentMonth: month === current,
		previous: shiftMonth(month, -1),
		next: month < current ? shiftMonth(month, 1) : null,
		filters,
		filtered: Object.values(filters).some(Boolean),
		totals: periodTotals(db, from, to, scope),
		rows
	};
};

export const actions: Actions = {
	/** The Add sheet posts here from any page. */
	create: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		try {
			const plan = planTransaction(
				{
					kind: text(form, 'kind'),
					date: text(form, 'date'),
					amount: text(form, 'amount'),
					accountId: text(form, 'accountId'),
					categoryId: text(form, 'categoryId') || null,
					toAccountId: text(form, 'toAccountId') || null,
					toAmount: text(form, 'toAmount') || null,
					note: text(form, 'note') || null
				},
				ledgerContext(app)
			);
			const id = createTransaction(app.treasury.db, plan);
			return { saved: id };
		} catch (error) {
			return fail(400, { errors: fieldErrors(error) });
		}
	}
};
