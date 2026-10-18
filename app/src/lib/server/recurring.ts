import {
	addDays,
	nextOccurrence,
	occurrences,
	parseSchedule,
	perMonth,
	planTransaction,
	type ProjectionEvent,
	type Schedule
} from '@treasure/core';
import {
	createTransaction,
	listRules,
	listTransactions,
	setRuleNextDue,
	type RecurringRule
} from '@treasure/db';
import { ledgerContext, toBase, today, typedAmount } from './ledger.ts';
import { log, logError } from './log.ts';
import type { Runtime } from './runtime.ts';

export function scheduleOf(rule: RecurringRule): Schedule | null {
	try {
		return parseSchedule(rule.rrule);
	} catch {
		return null;
	}
}

/** The first date on or after `from` a rule falls on. */
export function firstDue(
	rule: Pick<RecurringRule, 'rrule' | 'startDate' | 'endDate'>,
	from: string
): string | null {
	try {
		const schedule = parseSchedule(rule.rrule);
		return nextOccurrence(
			schedule,
			rule.startDate,
			from > rule.startDate ? from : rule.startDate,
			rule.endDate
		);
	} catch {
		return null;
	}
}

/**
 * Turns every recurring item that has come due into a transaction: posted straight away when
 * the item auto-posts with a fixed amount, otherwise waiting for you to confirm the real amount.
 * Safe to run any number of times; each due date is handled once.
 */
export function postDueItems(app: Runtime): number {
	const { db } = app.treasury;
	const day = today(app).day;
	let made = 0;
	for (const rule of listRules(db)) {
		if (rule.paused || !rule.nextDue || rule.nextDue > day) continue;
		const schedule = scheduleOf(rule);
		if (!schedule) continue;
		const context = ledgerContext(
			app,
			new Set([rule.accountId, ...(rule.toAccountId ? [rule.toAccountId] : [])])
		);
		try {
			for (const date of occurrences(schedule, rule.startDate, rule.nextDue, day, rule.endDate)) {
				const plan = planTransaction(
					{
						kind: rule.kind,
						date,
						amount: typedAmount(rule.amountMinor, rule.currency),
						accountId: rule.accountId,
						categoryId: rule.categoryId,
						toAccountId: rule.toAccountId,
						note: rule.name
					},
					context
				);
				const status = rule.autoPost && !rule.amountVaries ? 'posted' : 'pending';
				createTransaction(db, plan, { status, recurringId: rule.id });
				made += 1;
			}
			setRuleNextDue(
				db,
				rule.id,
				nextOccurrence(schedule, rule.startDate, addDays(day, 1), rule.endDate)
			);
		} catch (error) {
			logError('recurring', `${rule.name}: ${error instanceof Error ? error.message : error}`);
		}
	}
	if (made > 0) log('recurring', `created ${made} transaction(s) from recurring items`);
	return made;
}

/**
 * What recurring items and waiting confirmations will add to or take from the balance up to
 * `until`, in the base currency.
 */
export function upcomingEvents(app: Runtime, until: string): ProjectionEvent[] {
	const { db } = app.treasury;
	const day = today(app).day;
	const events: ProjectionEvent[] = [];

	for (const pending of listTransactions(db, { status: 'pending' })) {
		for (const leg of pending.legs) {
			if (pending.kind === 'transfer') continue;
			const base = toBase(app, leg.amountMinor, leg.currency);
			if (base !== null)
				events.push({ date: pending.date, amountMinor: base, label: pending.note ?? '' });
		}
	}

	for (const rule of listRules(db)) {
		if (rule.paused || rule.kind === 'transfer' || !rule.nextDue) continue;
		const schedule = scheduleOf(rule);
		if (!schedule) continue;
		const amount = toBase(app, rule.amountMinor, rule.currency);
		if (amount === null) continue;
		const sign = rule.kind === 'expense' ? -1 : 1;
		const from = rule.nextDue > day ? rule.nextDue : addDays(day, 1);
		for (const date of occurrences(schedule, rule.startDate, from, until, rule.endDate)) {
			events.push({ date, amountMinor: sign * amount, label: rule.name });
		}
	}
	return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** A rule's cost per month in the base currency (income positive), for the overview. */
export function monthlyEffect(app: Runtime, rule: RecurringRule): number | null {
	const schedule = scheduleOf(rule);
	if (!schedule || rule.kind === 'transfer') return null;
	const amount = toBase(app, rule.amountMinor, rule.currency);
	if (amount === null) return null;
	return Math.round((rule.kind === 'expense' ? -amount : amount) * perMonth(schedule));
}
