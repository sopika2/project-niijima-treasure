import { fail } from '@sveltejs/kit';
import { checkAccount, checkCategoryName, money, toDecimalString } from '@treasure/core';
import {
	accountBalances,
	accountInUse,
	AccountLockedError,
	categoryUsage,
	createAccount,
	createCategory,
	DuplicateNameError,
	listCategories,
	renameCategory,
	setAccountArchived,
	setCategoryArchived,
	updateAccount
} from '@treasure/db';
import { categoryOption, fieldErrors, ownerOf, scopeOf, text, today } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const app = await runtime();
	const { db } = app.treasury;
	const usage = categoryUsage(db);
	return {
		accounts: accountBalances(db, {
			asOf: today(app).day,
			includeArchived: true,
			scope: scopeOf(locals)
		}).map(({ account, balanceMinor }) => ({
			id: account.id,
			name: account.name,
			owner: account.owner,
			type: account.type,
			currency: account.currency,
			balance: balanceMinor,
			includeInTotal: account.includeInTotal,
			archived: account.archived,
			locked: accountInUse(db, account.id),
			form: {
				name: account.name,
				type: account.type,
				currency: account.currency,
				openingBalance:
					account.openingBalanceMinor === 0
						? ''
						: toDecimalString(money(account.openingBalanceMinor, account.currency)).replace(
								/\.00$/,
								''
							),
				openingDate: account.openingDate,
				includeInTotal: account.includeInTotal
			}
		})),
		categories: listCategories(db, { includeArchived: true }).map((category) => ({
			...categoryOption(category),
			archived: category.archived,
			used: usage.get(category.id) ?? 0
		})),
		currencies: ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'RON', 'JPY']
	};
};

const accountForm = (form: FormData) => ({
	name: text(form, 'name'),
	type: text(form, 'type'),
	currency: text(form, 'currency'),
	openingBalance: text(form, 'openingBalance'),
	openingDate: text(form, 'openingDate'),
	includeInTotal: form.get('includeInTotal') === 'on'
});

export const actions: Actions = {
	saveAccount: async ({ request, locals }) => {
		const app = await runtime();
		const form = await request.formData();
		const id = text(form, 'id');
		try {
			const clean = { ...checkAccount(accountForm(form)), owner: ownerOf(form, locals) };
			if (id) {
				if (!updateAccount(app.treasury.db, id, clean)) {
					return fail(404, { scope: 'account', errors: { form: 'not_found' } });
				}
			} else {
				createAccount(app.treasury.db, clean);
			}
			await app.rates.fetchMissing();
			return { saved: 'account' };
		} catch (error) {
			if (error instanceof AccountLockedError) {
				return fail(400, { scope: 'account', errors: { currency: 'currency_locked' } });
			}
			return fail(400, { scope: 'account', errors: fieldErrors(error) });
		}
	},

	archiveAccount: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		setAccountArchived(app.treasury.db, text(form, 'id'), form.get('archived') === 'true');
		return { saved: 'account' };
	},

	saveCategory: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		const id = text(form, 'id');
		const kind = text(form, 'kind');
		try {
			const name = checkCategoryName(text(form, 'name'));
			if (id) renameCategory(app.treasury.db, id, name);
			else if (kind === 'income' || kind === 'expense')
				createCategory(app.treasury.db, { name, kind });
			else return fail(400, { scope: 'category', errors: { kind: 'required' } });
			return { saved: 'category' };
		} catch (error) {
			if (error instanceof DuplicateNameError) {
				return fail(400, { scope: 'category', errors: { name: 'name_taken' } });
			}
			return fail(400, { scope: 'category', errors: fieldErrors(error) });
		}
	},

	archiveCategory: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		setCategoryArchived(app.treasury.db, text(form, 'id'), form.get('archived') === 'true');
		return { saved: 'category' };
	}
};
