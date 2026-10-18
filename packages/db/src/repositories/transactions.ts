import type { PlannedTransaction } from '@treasure/core';
import { and, between, desc, eq, inArray, isNull, like, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { transactionLegs, transactions, type Transaction, type TransactionLeg } from '../schema.ts';

export interface StoredTransaction extends Transaction {
	readonly legs: readonly TransactionLeg[];
}

function writeLegs(db: Db, transactionId: string, plan: PlannedTransaction): void {
	db.insert(transactionLegs)
		.values(
			plan.legs.map((leg) => ({
				transactionId,
				accountId: leg.accountId,
				amountMinor: leg.amountMinor,
				currency: leg.currency,
				categoryId: leg.categoryId,
				baseAmountMinor: leg.baseAmountMinor,
				rate: leg.rate
			}))
		)
		.run();
}

/** Stores a checked transaction and its entries in one go. Returns its id. */
export function createTransaction(
	db: Db,
	plan: PlannedTransaction,
	options: { status?: 'posted' | 'pending'; recurringId?: string | null } = {}
): string {
	return db.transaction((tx) => {
		const [row] = tx
			.insert(transactions)
			.values({
				date: plan.date,
				kind: plan.kind,
				note: plan.note,
				status: options.status ?? 'posted',
				recurringId: options.recurringId ?? null
			})
			.returning({ id: transactions.id })
			.all();
		if (!row) throw new Error('The transaction was not created.');
		writeLegs(tx as unknown as Db, row.id, plan);
		return row.id;
	});
}

/**
 * Replaces a transaction's details and entries. Returns false when it doesn't exist.
 * Saving a pending one confirms it.
 */
export function updateTransaction(db: Db, id: string, plan: PlannedTransaction): boolean {
	return db.transaction((tx) => {
		const changed = tx
			.update(transactions)
			.set({ date: plan.date, kind: plan.kind, note: plan.note, status: 'posted' })
			.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
			.run().changes;
		if (changed === 0) return false;
		tx.delete(transactionLegs).where(eq(transactionLegs.transactionId, id)).run();
		writeLegs(tx as unknown as Db, id, plan);
		return true;
	});
}

/** Marks a transaction deleted. It disappears everywhere but stays in older backups. */
export function deleteTransaction(db: Db, id: string): boolean {
	return (
		db
			.update(transactions)
			.set({ deletedAt: new Date().toISOString() })
			.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
			.run().changes > 0
	);
}

function withLegs(db: Db, rows: Transaction[]): StoredTransaction[] {
	if (rows.length === 0) return [];
	const legs = db
		.select()
		.from(transactionLegs)
		.where(
			inArray(
				transactionLegs.transactionId,
				rows.map((row) => row.id)
			)
		)
		.all();
	const byTransaction = new Map<string, TransactionLeg[]>();
	for (const leg of legs) {
		const list = byTransaction.get(leg.transactionId) ?? [];
		list.push(leg);
		byTransaction.set(leg.transactionId, list);
	}
	return rows.map((row) => ({
		...row,
		// Money leaving first, so a transfer always reads "from → to".
		legs: (byTransaction.get(row.id) ?? []).sort((a, b) => a.amountMinor - b.amountMinor)
	}));
}

export function getTransaction(db: Db, id: string): StoredTransaction | undefined {
	const row = db
		.select()
		.from(transactions)
		.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
		.get();
	return row ? withLegs(db, [row])[0] : undefined;
}

export interface TransactionFilter {
	/** Inclusive date range, YYYY-MM-DD. */
	readonly from?: string;
	readonly to?: string;
	readonly accountId?: string;
	readonly categoryId?: string;
	readonly kind?: Transaction['kind'];
	/** Matches the note, case-insensitive. */
	readonly search?: string;
	readonly status?: 'posted' | 'pending';
	readonly limit?: number;
}

/** Newest first. Deleted transactions never appear. */
export function listTransactions(db: Db, filter: TransactionFilter = {}): StoredTransaction[] {
	const conditions: SQL[] = [isNull(transactions.deletedAt)];
	if (filter.from && filter.to) conditions.push(between(transactions.date, filter.from, filter.to));
	if (filter.kind) conditions.push(eq(transactions.kind, filter.kind));
	if (filter.status) conditions.push(eq(transactions.status, filter.status));
	if (filter.search?.trim()) {
		const escaped = filter.search
			.trim()
			.toLowerCase()
			.replace(/[\\%_]/g, (match) => `\\${match}`);
		conditions.push(
			sql`lower(coalesce(${transactions.note}, '')) like ${`%${escaped}%`} escape '\\'`
		);
	}
	if (filter.accountId || filter.categoryId) {
		const legConditions: SQL[] = [];
		if (filter.accountId) legConditions.push(eq(transactionLegs.accountId, filter.accountId));
		if (filter.categoryId) legConditions.push(eq(transactionLegs.categoryId, filter.categoryId));
		conditions.push(
			inArray(
				transactions.id,
				db
					.select({ id: transactionLegs.transactionId })
					.from(transactionLegs)
					.where(and(...legConditions))
			)
		);
	}
	const query = db
		.select()
		.from(transactions)
		.where(and(...conditions))
		.orderBy(desc(transactions.date), desc(transactions.createdAt));
	const rows = filter.limit ? query.limit(filter.limit).all() : query.all();
	return withLegs(db, rows);
}

export interface PeriodTotals {
	/** Income in the base currency, minor units, positive. */
	readonly incomeMinor: number;
	/** Spending in the base currency, minor units, positive. */
	readonly expenseMinor: number;
	/** Entries left out because no exchange rate was known for them. */
	readonly missingRates: number;
}

const live = () => and(isNull(transactions.deletedAt), eq(transactions.status, 'posted'));

/** Income and spending between two dates (inclusive). Transfers are neither. */
export function periodTotals(db: Db, from: string, to: string): PeriodTotals {
	const row = db
		.select({
			income: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactionLegs.baseAmountMinor} end), 0)`,
			expense: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then -${transactionLegs.baseAmountMinor} end), 0)`,
			missing: sql<number>`sum(case when ${transactions.kind} != 'transfer' and ${transactionLegs.baseAmountMinor} is null then 1 else 0 end)`
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(live(), between(transactions.date, from, to)))
		.get();
	return {
		incomeMinor: Number(row?.income ?? 0),
		expenseMinor: Number(row?.expense ?? 0),
		missingRates: Number(row?.missing ?? 0)
	};
}

export interface CategorySpending {
	readonly categoryId: string | null;
	/** Positive, base currency, minor units. */
	readonly amountMinor: number;
	readonly count: number;
}

/** Spending per category between two dates, biggest first. */
export function spendingByCategory(db: Db, from: string, to: string): CategorySpending[] {
	return db
		.select({
			categoryId: transactionLegs.categoryId,
			amountMinor: sql<number>`coalesce(sum(-${transactionLegs.baseAmountMinor}), 0)`,
			count: sql<number>`count(*)`
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(live(), eq(transactions.kind, 'expense'), between(transactions.date, from, to)))
		.groupBy(transactionLegs.categoryId)
		.all()
		.map((row) => ({ ...row, amountMinor: Number(row.amountMinor), count: Number(row.count) }))
		.filter((row) => row.amountMinor > 0)
		.sort((a, b) => b.amountMinor - a.amountMinor);
}

/** Confirms a pending transaction as it is. */
export function postPending(db: Db, id: string): boolean {
	return (
		db
			.update(transactions)
			.set({ status: 'posted' })
			.where(
				and(
					eq(transactions.id, id),
					eq(transactions.status, 'pending'),
					isNull(transactions.deletedAt)
				)
			)
			.run().changes > 0
	);
}

/**
 * Average everyday spending per day between two dates, in the base currency: expenses that did
 * not come from a recurring item (those are already in the projection on their own).
 */
export function averageDailySpend(db: Db, from: string, to: string): number {
	const row = db
		.select({ total: sql<number>`coalesce(sum(-${transactionLegs.baseAmountMinor}), 0)` })
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(
			and(
				live(),
				eq(transactions.kind, 'expense'),
				isNull(transactions.recurringId),
				between(transactions.date, from, to)
			)
		)
		.get();
	const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
	return Math.max(0, Number(row?.total ?? 0)) / days;
}

export interface MonthTotals extends PeriodTotals {
	/** YYYY-MM */
	readonly month: string;
}

/** Income and spending per month between two dates, oldest first; months with nothing are 0. */
export function monthlyTotals(db: Db, from: string, to: string): MonthTotals[] {
	const rows = db
		.select({
			month: sql<string>`substr(${transactions.date}, 1, 7)`,
			income: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactionLegs.baseAmountMinor} end), 0)`,
			expense: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then -${transactionLegs.baseAmountMinor} end), 0)`,
			missing: sql<number>`sum(case when ${transactions.kind} != 'transfer' and ${transactionLegs.baseAmountMinor} is null then 1 else 0 end)`
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(live(), between(transactions.date, from, to)))
		.groupBy(sql`substr(${transactions.date}, 1, 7)`)
		.all();
	const byMonth = new Map(rows.map((row) => [row.month, row]));
	const months: MonthTotals[] = [];
	let cursor = from.slice(0, 7);
	while (cursor <= to.slice(0, 7)) {
		const row = byMonth.get(cursor);
		months.push({
			month: cursor,
			incomeMinor: Number(row?.income ?? 0),
			expenseMinor: Number(row?.expense ?? 0),
			missingRates: Number(row?.missing ?? 0)
		});
		const [year, month] = cursor.split('-').map(Number) as [number, number];
		cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
	}
	return months;
}

/** Every live transaction with its entries between two dates, oldest first, for exports. */
export function exportRows(db: Db, from: string, to: string) {
	return db
		.select({
			id: transactions.id,
			date: transactions.date,
			kind: transactions.kind,
			status: transactions.status,
			note: transactions.note,
			accountId: transactionLegs.accountId,
			categoryId: transactionLegs.categoryId,
			amountMinor: transactionLegs.amountMinor,
			currency: transactionLegs.currency,
			baseAmountMinor: transactionLegs.baseAmountMinor,
			rate: transactionLegs.rate
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(isNull(transactions.deletedAt), between(transactions.date, from, to)))
		.orderBy(transactions.date, transactions.createdAt, transactionLegs.amountMinor)
		.all();
}

/** Notes used before, most frequent first, for suggestions while typing. */
export function frequentNotes(db: Db, limit = 30): string[] {
	return db
		.select({ note: transactions.note, n: sql<number>`count(*)` })
		.from(transactions)
		.where(
			and(
				isNull(transactions.deletedAt),
				sql`${transactions.note} is not null`,
				like(transactions.note, '%')
			)
		)
		.groupBy(transactions.note)
		.orderBy(desc(sql`count(*)`))
		.limit(limit)
		.all()
		.map((row) => row.note as string);
}
