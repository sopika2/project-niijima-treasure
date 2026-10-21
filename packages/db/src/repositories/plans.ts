import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import {
	budgets,
	goalContributions,
	goals,
	type Budget,
	type Goal,
	type Owner
} from '../schema.ts';
import { ownedBy, type Scope } from '../scope.ts';

/* ── Budgets ─────────────────────────────────────────────────────────────── */

/**
 * The limit that applies to each category in a month: that month's own limit if one is set,
 * otherwise the category's default (month = null).
 */
export function budgetsForMonth(db: Db, month: string, scope?: Scope | null): Budget[] {
	const rows = db
		.select()
		.from(budgets)
		.where(and(or(isNull(budgets.month), eq(budgets.month, month)), ownedBy(budgets.owner, scope)))
		.all();
	// One limit per owner and category: that month's own one wins over the default.
	const byCategory = new Map<string, Budget>();
	for (const row of rows) {
		const key = `${row.owner}:${row.categoryId}`;
		const current = byCategory.get(key);
		if (!current || (current.month === null && row.month !== null)) byCategory.set(key, row);
	}
	return [...byCategory.values()];
}

/** Sets a category's default monthly limit (or that one month's, with `month`). */
export function setBudget(
	db: Db,
	input: {
		categoryId: string;
		limitMinor: number;
		currency: string;
		month?: string | null;
		owner?: Owner;
	}
): void {
	const month = input.month ?? null;
	const owner = input.owner ?? 'shared';
	const existing = db
		.select({ id: budgets.id })
		.from(budgets)
		.where(
			and(
				eq(budgets.owner, owner),
				eq(budgets.categoryId, input.categoryId),
				month === null ? isNull(budgets.month) : eq(budgets.month, month)
			)
		)
		.get();
	if (existing) {
		db.update(budgets)
			.set({ limitMinor: input.limitMinor, currency: input.currency })
			.where(eq(budgets.id, existing.id))
			.run();
	} else {
		db.insert(budgets)
			.values({ ...input, month, owner })
			.run();
	}
}

export function removeBudget(db: Db, categoryId: string, owner: Owner = 'shared'): void {
	db.delete(budgets)
		.where(and(eq(budgets.categoryId, categoryId), eq(budgets.owner, owner)))
		.run();
}

/* ── Goals (shown as Treasures) ──────────────────────────────────────────── */

export interface GoalInput {
	readonly name: string;
	readonly targetMinor: number;
	readonly currency: string;
	readonly deadline: string | null;
	readonly accountId: string | null;
	/** Left out on update, it stays as it was. */
	readonly owner?: Owner;
}

export function listGoals(
	db: Db,
	options: { includeArchived?: boolean; scope?: Scope | null } = {}
): Goal[] {
	return db
		.select()
		.from(goals)
		.where(
			and(
				options.includeArchived ? undefined : eq(goals.archived, false),
				ownedBy(goals.owner, options.scope)
			)
		)
		.orderBy(asc(goals.archived), asc(goals.deadline), asc(goals.name))
		.all();
}

export function createGoal(db: Db, input: GoalInput): Goal {
	const [row] = db.insert(goals).values(input).returning().all();
	if (!row) throw new Error('The goal was not created.');
	return row;
}

export function updateGoal(db: Db, id: string, input: GoalInput): Goal | undefined {
	return db.update(goals).set(input).where(eq(goals.id, id)).returning().get();
}

export function setGoalArchived(db: Db, id: string, archived: boolean): boolean {
	return db.update(goals).set({ archived }).where(eq(goals.id, id)).run().changes > 0;
}

export function addContribution(db: Db, goalId: string, date: string, amountMinor: number): void {
	db.insert(goalContributions).values({ goalId, date, amountMinor }).run();
}

/** Saved so far through contributions, and how much of it arrived since `since`. */
export function contributionTotals(
	db: Db,
	goalId: string,
	since: string
): { total: number; recent: number } {
	const row = db
		.select({
			total: sql<number>`coalesce(sum(${goalContributions.amountMinor}), 0)`,
			recent: sql<number>`coalesce(sum(case when ${goalContributions.date} >= ${since} then ${goalContributions.amountMinor} end), 0)`
		})
		.from(goalContributions)
		.where(eq(goalContributions.goalId, goalId))
		.get();
	return { total: Number(row?.total ?? 0), recent: Number(row?.recent ?? 0) };
}

export function recentContributions(db: Db, goalId: string, limit = 5) {
	return db
		.select()
		.from(goalContributions)
		.where(eq(goalContributions.goalId, goalId))
		.orderBy(desc(goalContributions.date), desc(goalContributions.createdAt))
		.limit(limit)
		.all();
}
