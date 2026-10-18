import { error, fail, redirect } from '@sveltejs/kit';
import { planTransaction, toDecimalString, money } from '@treasure/core';
import {
	deleteTransaction,
	getTransaction,
	listAccounts,
	listCategories,
	updateTransaction
} from '@treasure/db';
import {
	accountOption,
	categoryOption,
	fieldErrors,
	ledgerContext,
	text
} from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

/** The amount as people type it, e.g. 4500 or 12.5, without the sign. */
const typed = (amount: number, currency: string) =>
	toDecimalString(money(Math.abs(amount), currency)).replace(/\.00$/, '');

export const load: PageServerLoad = async ({ params }) => {
	const app = await runtime();
	const transaction = getTransaction(app.treasury.db, params.id);
	if (!transaction) error(404, 'not_found');
	const [first, second] = transaction.legs;
	return {
		values: {
			id: transaction.id,
			kind: transaction.kind,
			date: transaction.date,
			note: transaction.note ?? '',
			accountId: first?.accountId ?? '',
			amount: first ? typed(first.amountMinor, first.currency) : '',
			categoryId: first?.categoryId ?? '',
			toAccountId: transaction.kind === 'transfer' ? (second?.accountId ?? '') : '',
			toAmount:
				transaction.kind === 'transfer' && second && first && second.currency !== first.currency
					? typed(second.amountMinor, second.currency)
					: ''
		},
		// Accounts archived since stay selectable on the transaction that already uses them.
		accounts: listAccounts(app.treasury.db, { includeArchived: true })
			.filter(
				(account) =>
					!account.archived || transaction.legs.some((leg) => leg.accountId === account.id)
			)
			.map(accountOption),
		categories: listCategories(app.treasury.db, { includeArchived: true })
			.filter((category) => !category.archived || category.id === first?.categoryId)
			.map(categoryOption)
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const app = await runtime();
		const existing = getTransaction(app.treasury.db, params.id);
		if (!existing) return fail(404, { errors: { form: 'not_found' as const } });
		const form = await request.formData();
		let plan;
		try {
			plan = planTransaction(
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
				// An account archived since may stay on the transaction it already had.
				ledgerContext(app, new Set(existing.legs.map((leg) => leg.accountId)))
			);
		} catch (problem) {
			return fail(400, { errors: fieldErrors(problem) });
		}
		updateTransaction(app.treasury.db, params.id, plan);
		redirect(303, `/transactions?month=${plan.date.slice(0, 7)}&saved=1`);
	},

	delete: async ({ params }) => {
		const app = await runtime();
		const existing = getTransaction(app.treasury.db, params.id);
		deleteTransaction(app.treasury.db, params.id);
		redirect(303, `/transactions?month=${existing?.date.slice(0, 7) ?? ''}&deleted=1`);
	}
};
