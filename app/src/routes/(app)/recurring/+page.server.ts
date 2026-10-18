import { fail } from '@sveltejs/kit';
import { addDays, checkRecurring, planTransaction } from '@treasure/core';
import {
	createRule,
	deleteRule,
	deleteTransaction,
	getRule,
	getTransaction,
	listRules,
	listTransactions,
	postPending,
	setRuleNextDue,
	setRulePaused,
	updateRule,
	updateTransaction,
	type RecurringRule
} from '@treasure/db';
import {
	fieldErrors,
	ledgerContext,
	lookup,
	text,
	today,
	transactionRow,
	typedAmount
} from '#lib/server/ledger.ts';
import { firstDue, monthlyEffect, postDueItems, scheduleOf } from '#lib/server/recurring.ts';
import { runtime, type Runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = await runtime();
	const { db } = app.treasury;
	const { accounts, categories } = lookup(app);
	const rules = listRules(db).map((rule) => {
		const schedule = scheduleOf(rule);
		const category = rule.categoryId ? categories.get(rule.categoryId) : undefined;
		return {
			id: rule.id,
			name: rule.name,
			kind: rule.kind,
			amount: rule.amountMinor,
			currency: rule.currency,
			account: accounts.get(rule.accountId)?.name ?? '?',
			toAccount: rule.toAccountId ? (accounts.get(rule.toAccountId)?.name ?? '?') : null,
			category: category?.name ?? null,
			color: category ? Number(category.color) || 8 : 8,
			freq: schedule?.freq ?? 'monthly',
			interval: schedule?.interval ?? 1,
			dayOfMonth: schedule?.dayOfMonth ?? null,
			nextDue: rule.nextDue,
			paused: rule.paused,
			autoPost: rule.autoPost,
			amountVaries: rule.amountVaries,
			perMonth: monthlyEffect(app, rule),
			form: {
				name: rule.name,
				kind: rule.kind,
				amount: typedAmount(rule.amountMinor, rule.currency).replace(/\.00$/, ''),
				accountId: rule.accountId,
				categoryId: rule.categoryId ?? '',
				toAccountId: rule.toAccountId ?? '',
				date: rule.startDate,
				freq: schedule?.freq ?? 'monthly',
				interval: String(schedule?.interval ?? 1),
				dayOfMonth:
					schedule?.dayOfMonth && schedule.dayOfMonth !== Number(rule.startDate.slice(8, 10))
						? String(schedule.dayOfMonth)
						: '',
				endDate: rule.endDate ?? '',
				autoPost: rule.autoPost,
				amountVaries: rule.amountVaries
			}
		};
	});
	const pending = listTransactions(db, { status: 'pending' })
		.sort((a, b) => a.date.localeCompare(b.date))
		.map((transaction) => ({
			...transactionRow(transaction, accounts, categories),
			typed: typedAmount(
				transaction.legs[0]?.amountMinor ?? 0,
				transaction.legs[0]?.currency ?? 'HUF'
			).replace(/\.00$/, '')
		}));
	const monthly = rules
		.filter((rule) => !rule.paused && rule.nextDue && rule.perMonth !== null)
		.reduce((total, rule) => total + (rule.perMonth ?? 0), 0);
	return { rules, pending, monthly };
};

/** The next date a saved rule should post on, never repeating one already posted. */
function nextDueFor(app: Runtime, rule: RecurringRule, previous?: RecurringRule): string | null {
	const day = today(app).day;
	const postedToday =
		previous && (!previous.nextDue || previous.nextDue > day) && previous.startDate <= day;
	return firstDue(rule, postedToday ? addDays(day, 1) : day);
}

export const actions: Actions = {
	save: async ({ request }) => {
		const app = await runtime();
		const { db } = app.treasury;
		const form = await request.formData();
		const id = text(form, 'id');
		const previous = id ? getRule(db, id) : undefined;
		if (id && !previous) return fail(404, { errors: { form: 'not_found' } });
		const allow = new Set([text(form, 'accountId'), text(form, 'toAccountId')].filter(Boolean));
		try {
			const clean = checkRecurring(
				{
					name: text(form, 'name'),
					kind: text(form, 'kind') as 'income' | 'expense' | 'transfer',
					date: text(form, 'date'),
					amount: text(form, 'amount'),
					accountId: text(form, 'accountId'),
					categoryId: text(form, 'categoryId') || null,
					toAccountId: text(form, 'toAccountId') || null,
					note: text(form, 'name'),
					freq: text(form, 'freq'),
					interval: text(form, 'interval'),
					dayOfMonth: text(form, 'dayOfMonth') || null,
					endDate: text(form, 'endDate') || null,
					autoPost: form.get('autoPost') === 'on',
					amountVaries: form.get('amountVaries') === 'on'
				},
				ledgerContext(app, previous ? allow : undefined)
			);
			if (previous) {
				const draft = updateRule(db, previous.id, clean, null);
				if (draft) setRuleNextDue(db, draft.id, nextDueFor(app, draft, previous));
			} else {
				const draft = createRule(db, clean, null);
				setRuleNextDue(db, draft.id, nextDueFor(app, draft));
			}
			postDueItems(app);
			return { saved: true };
		} catch (error) {
			return fail(400, { errors: fieldErrors(error) });
		}
	},

	pause: async ({ request }) => {
		const app = await runtime();
		const { db } = app.treasury;
		const form = await request.formData();
		const rule = getRule(db, text(form, 'id'));
		if (!rule) return fail(404, { errors: { form: 'not_found' } });
		const paused = form.get('paused') === 'true';
		setRulePaused(db, rule.id, paused);
		// Coming back from a pause starts from today instead of catching up on every missed date.
		if (!paused) setRuleNextDue(db, rule.id, nextDueFor(app, rule, rule));
		return { saved: true };
	},

	remove: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		if (!deleteRule(app.treasury.db, text(form, 'id'))) {
			return fail(404, { errors: { form: 'not_found' } });
		}
		return { deleted: true };
	},

	/** Logs a waiting item, with the amount you typed if it changed. */
	confirm: async ({ request }) => {
		const app = await runtime();
		const { db } = app.treasury;
		const form = await request.formData();
		const transaction = getTransaction(db, text(form, 'id'));
		if (!transaction || transaction.status !== 'pending') {
			return fail(404, { errors: { form: 'not_found' } });
		}
		const amount = text(form, 'amount').trim();
		const [first, second] = transaction.legs;
		if (!amount || !first) {
			postPending(db, transaction.id);
			return { confirmed: true };
		}
		try {
			const plan = planTransaction(
				{
					kind: transaction.kind,
					date: transaction.date,
					amount,
					accountId: first.accountId,
					categoryId: first.categoryId,
					toAccountId: transaction.kind === 'transfer' ? (second?.accountId ?? null) : null,
					note: transaction.note
				},
				ledgerContext(app, new Set(transaction.legs.map((leg) => leg.accountId)))
			);
			updateTransaction(db, transaction.id, plan);
			return { confirmed: true };
		} catch (error) {
			return fail(400, { id: transaction.id, errors: fieldErrors(error) });
		}
	},

	skip: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		const transaction = getTransaction(app.treasury.db, text(form, 'id'));
		if (!transaction || transaction.status !== 'pending') {
			return fail(404, { errors: { form: 'not_found' } });
		}
		deleteTransaction(app.treasury.db, transaction.id);
		return { skipped: true };
	}
};
