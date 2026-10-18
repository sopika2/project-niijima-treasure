import { formatSchedule, type CleanRecurring } from '@treasure/core';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { recurringRules, transactions, type RecurringRule } from '../schema.ts';

export function listRules(db: Db): RecurringRule[] {
	return db
		.select()
		.from(recurringRules)
		.orderBy(asc(recurringRules.paused), asc(recurringRules.nextDue), asc(recurringRules.name))
		.all();
}

export function getRule(db: Db, id: string): RecurringRule | undefined {
	return db.select().from(recurringRules).where(eq(recurringRules.id, id)).get();
}

function values(rule: CleanRecurring) {
	return {
		name: rule.name,
		kind: rule.kind,
		amountMinor: rule.amountMinor,
		currency: rule.currency,
		accountId: rule.accountId,
		toAccountId: rule.toAccountId,
		categoryId: rule.categoryId,
		rrule: formatSchedule({
			freq: rule.freq,
			interval: rule.interval,
			...(rule.dayOfMonth !== null ? { dayOfMonth: rule.dayOfMonth } : {})
		}),
		startDate: rule.startDate,
		endDate: rule.endDate,
		autoPost: rule.autoPost,
		amountVaries: rule.amountVaries
	};
}

export function createRule(db: Db, rule: CleanRecurring, nextDue: string | null): RecurringRule {
	const [row] = db
		.insert(recurringRules)
		.values({ ...values(rule), nextDue })
		.returning()
		.all();
	if (!row) throw new Error('The recurring item was not created.');
	return row;
}

export function updateRule(
	db: Db,
	id: string,
	rule: CleanRecurring,
	nextDue: string | null
): RecurringRule | undefined {
	return db
		.update(recurringRules)
		.set({ ...values(rule), nextDue })
		.where(eq(recurringRules.id, id))
		.returning()
		.get();
}

export function setRuleNextDue(db: Db, id: string, nextDue: string | null): void {
	db.update(recurringRules).set({ nextDue }).where(eq(recurringRules.id, id)).run();
}

export function setRulePaused(db: Db, id: string, paused: boolean): boolean {
	return (
		db.update(recurringRules).set({ paused }).where(eq(recurringRules.id, id)).run().changes > 0
	);
}

/** Removes a rule. Transactions it already made stay, they just lose the link. */
export function deleteRule(db: Db, id: string): boolean {
	return db.transaction((tx) => {
		tx.update(transactions)
			.set({ recurringId: null })
			.where(eq(transactions.recurringId, id))
			.run();
		return tx.delete(recurringRules).where(eq(recurringRules.id, id)).run().changes > 0;
	});
}

/** Live transactions waiting for a tap to confirm, oldest first. */
export function countPending(db: Db): number {
	return (
		db
			.select({ n: count() })
			.from(transactions)
			.where(and(eq(transactions.status, 'pending'), isNull(transactions.deletedAt)))
			.get()?.n ?? 0
	);
}
