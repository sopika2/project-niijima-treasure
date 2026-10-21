import { fail } from '@sveltejs/kit';
import { checkAmount, isIsoDate, LedgerError, type FieldErrors } from '@treasure/core';
import {
	addContribution,
	createGoal,
	listAccounts,
	listGoals,
	setGoalArchived,
	updateGoal
} from '@treasure/db';
import { fieldErrors, ownerOf, scopeOf, text, today, typedAmount } from '#lib/server/ledger.ts';
import { goalRows } from '#lib/server/plans.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const app = await runtime();
	const scope = scopeOf(locals);
	return {
		goals: goalRows(app, { includeArchived: true, scope }).map((goal) => ({
			...goal,
			form: {
				name: goal.name,
				target: typedAmount(goal.targetMinor, goal.currency).replace(/\.00$/, ''),
				currency: goal.currency,
				deadline: goal.deadline ?? '',
				accountId: goal.accountId ?? ''
			}
		})),
		currencies: [
			...new Set([
				app.config.base_currency,
				...listAccounts(app.treasury.db, { scope }).map((a) => a.currency)
			])
		]
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const app = await runtime();
		const { db } = app.treasury;
		const form = await request.formData();
		const id = text(form, 'id');
		const errors: FieldErrors = {};
		const name = text(form, 'name').trim().slice(0, 60);
		if (!name) errors.name = 'required';
		const accountId = text(form, 'accountId') || null;
		const account = accountId
			? listAccounts(db, { includeArchived: true }).find((a) => a.id === accountId)
			: null;
		if (accountId && !account) errors.accountId = 'unknown_account';
		const currency = account?.currency ?? (text(form, 'currency') || app.config.base_currency);
		let targetMinor = 0;
		try {
			targetMinor = checkAmount(text(form, 'target'), currency, 'target');
		} catch (error) {
			Object.assign(errors, fieldErrors(error));
		}
		const deadline = text(form, 'deadline').trim() || null;
		if (deadline && (!isIsoDate(deadline) || deadline <= today(app).day))
			errors.deadline = 'invalid_date';
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		const input = {
			name,
			targetMinor,
			currency,
			deadline,
			accountId,
			owner: ownerOf(form, locals)
		};
		if (id) {
			if (!updateGoal(db, id, input)) return fail(404, { errors: { form: 'not_found' } });
		} else {
			createGoal(db, input);
		}
		return { saved: true };
	},

	archive: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		setGoalArchived(app.treasury.db, text(form, 'id'), form.get('archived') === 'true');
		return { saved: true };
	},

	/** Money set aside by hand for a Treasure that isn't tied to an account. */
	contribute: async ({ request }) => {
		const app = await runtime();
		const { db } = app.treasury;
		const form = await request.formData();
		const goal = listGoals(db, { includeArchived: true }).find(
			(row) => row.id === text(form, 'id')
		);
		if (!goal) return fail(404, { errors: { form: 'not_found' } });
		try {
			const typed = text(form, 'amount').trim();
			const negative = typed.startsWith('-');
			const amount = checkAmount(negative ? typed.slice(1) : typed, goal.currency);
			addContribution(db, goal.id, today(app).day, negative ? -amount : amount);
			return { contributed: true };
		} catch (error) {
			if (error instanceof LedgerError) return fail(400, { id: goal.id, errors: error.fields });
			throw error;
		}
	}
};
