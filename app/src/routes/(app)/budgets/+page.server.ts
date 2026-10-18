import { fail } from '@sveltejs/kit';
import { checkAmount, LedgerError } from '@treasure/core';
import { listCategories, removeBudget, setBudget } from '@treasure/db';
import {
	categoryOption,
	fieldErrors,
	isMonth,
	text,
	today,
	typedAmount
} from '#lib/server/ledger.ts';
import { budgetRows } from '#lib/server/plans.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = await runtime();
	const { day, month } = today(app);
	const rows = budgetRows(app, month);
	const taken = new Set(rows.map((row) => row.categoryId));
	const free = listCategories(app.treasury.db)
		.filter((category) => category.kind === 'expense' && !taken.has(category.id))
		.map(categoryOption);
	const [year, number] = month.split('-').map(Number) as [number, number];
	const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
	return {
		month,
		dayShare: Number(day.slice(8, 10)) / daysInMonth,
		rows: rows.map((row) => ({
			...row,
			typed: typedAmount(row.limitMinor, row.currency).replace(/\.00$/, '')
		})),
		free,
		totals: rows.reduce(
			(sum, row) => ({ limit: sum.limit + row.limitMinor, spent: sum.spent + row.spentMinor }),
			{ limit: 0, spent: 0 }
		)
	};
};

export const actions: Actions = {
	set: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		const categoryId = text(form, 'categoryId');
		const base = app.config.base_currency;
		const category = listCategories(app.treasury.db).find((row) => row.id === categoryId);
		if (!category || category.kind !== 'expense') {
			return fail(400, { errors: { categoryId: 'unknown_category' } });
		}
		try {
			const limitMinor = checkAmount(text(form, 'limit'), base, 'limit');
			const month = text(form, 'month');
			setBudget(app.treasury.db, {
				categoryId,
				limitMinor,
				currency: base,
				month: isMonth(month) ? month : null
			});
			return { saved: true };
		} catch (error) {
			if (error instanceof LedgerError)
				return fail(400, { categoryId, errors: fieldErrors(error) });
			throw error;
		}
	},

	remove: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		removeBudget(app.treasury.db, text(form, 'categoryId'));
		return { removed: true };
	}
};
