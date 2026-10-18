import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import {
	accounts,
	categories,
	transactionLegs,
	transactions,
	type Account,
	type Category
} from '../schema.ts';

/* ── Accounts ────────────────────────────────────────────────────────────── */

export interface AccountInput {
	readonly name: string;
	readonly type: Account['type'];
	readonly currency: string;
	readonly openingBalanceMinor: number;
	readonly openingDate: string;
	readonly includeInTotal: boolean;
}

export function listAccounts(db: Db, options: { includeArchived?: boolean } = {}): Account[] {
	return db
		.select()
		.from(accounts)
		.where(options.includeArchived ? undefined : eq(accounts.archived, false))
		.orderBy(asc(accounts.archived), asc(accounts.sortOrder), asc(accounts.name))
		.all();
}

export function getAccount(db: Db, id: string): Account | undefined {
	return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

/** True once any transaction (deleted ones too) uses the account, which locks its currency. */
export function accountInUse(db: Db, id: string): boolean {
	const row = db
		.select({ n: count() })
		.from(transactionLegs)
		.where(eq(transactionLegs.accountId, id))
		.get();
	return (row?.n ?? 0) > 0;
}

export function createAccount(db: Db, input: AccountInput): Account {
	const last = db
		.select({ max: sql<number>`coalesce(max(${accounts.sortOrder}), -1)` })
		.from(accounts)
		.get();
	const [row] = db
		.insert(accounts)
		.values({ ...input, sortOrder: (last?.max ?? -1) + 1 })
		.returning()
		.all();
	if (!row) throw new Error('The account was not created.');
	return row;
}

export class AccountLockedError extends Error {
	constructor() {
		super('The currency of an account with transactions cannot change.');
		this.name = 'AccountLockedError';
	}
}

export function updateAccount(db: Db, id: string, input: AccountInput): Account | undefined {
	return db.transaction((tx) => {
		const current = tx.select().from(accounts).where(eq(accounts.id, id)).get();
		if (!current) return undefined;
		if (current.currency !== input.currency && accountInUse(tx as unknown as Db, id)) {
			throw new AccountLockedError();
		}
		return tx.update(accounts).set(input).where(eq(accounts.id, id)).returning().get();
	});
}

export function setAccountArchived(db: Db, id: string, archived: boolean): boolean {
	const result = db.update(accounts).set({ archived }).where(eq(accounts.id, id)).run();
	return result.changes > 0;
}

/* ── Categories ──────────────────────────────────────────────────────────── */

/** Starting categories, created once on an empty database. Rename or archive them freely. */
export const defaultCategories: ReadonlyArray<{
	name: string;
	kind: 'income' | 'expense';
	color: number;
}> = [
	{ name: 'Groceries', kind: 'expense', color: 1 },
	{ name: 'Eating out', kind: 'expense', color: 2 },
	{ name: 'Transport', kind: 'expense', color: 3 },
	{ name: 'Home and bills', kind: 'expense', color: 4 },
	{ name: 'Subscriptions', kind: 'expense', color: 5 },
	{ name: 'Hosting and tech', kind: 'expense', color: 6 },
	{ name: 'Games and fun', kind: 'expense', color: 7 },
	{ name: 'Shopping', kind: 'expense', color: 8 },
	{ name: 'Health', kind: 'expense', color: 1 },
	{ name: 'Gifts', kind: 'expense', color: 2 },
	{ name: 'Other spending', kind: 'expense', color: 8 },
	{ name: 'Salary', kind: 'income', color: 4 },
	{ name: 'Side income', kind: 'income', color: 3 },
	{ name: 'Gifts received', kind: 'income', color: 2 },
	{ name: 'Refunds', kind: 'income', color: 6 },
	{ name: 'Other income', kind: 'income', color: 8 }
];

/** Adds the default categories if there are none at all. Returns how many were added. */
export function seedCategories(db: Db): number {
	const existing = db.select({ n: count() }).from(categories).get();
	if ((existing?.n ?? 0) > 0) return 0;
	db.insert(categories)
		.values(
			defaultCategories.map((category, index) => ({
				name: category.name,
				kind: category.kind,
				color: String(category.color),
				sortOrder: index
			}))
		)
		.run();
	return defaultCategories.length;
}

export function listCategories(db: Db, options: { includeArchived?: boolean } = {}): Category[] {
	return db
		.select()
		.from(categories)
		.where(options.includeArchived ? undefined : eq(categories.archived, false))
		.orderBy(
			asc(categories.kind),
			asc(categories.archived),
			asc(categories.sortOrder),
			asc(categories.name)
		)
		.all();
}

export class DuplicateNameError extends Error {
	constructor() {
		super('That name is already used.');
		this.name = 'DuplicateNameError';
	}
}

function nameTaken(db: Db, kind: Category['kind'], name: string, except?: string): boolean {
	const rows = db
		.select({ id: categories.id })
		.from(categories)
		.where(
			and(
				eq(categories.kind, kind),
				sql`lower(${categories.name}) = lower(${name})`,
				isNull(categories.parentId)
			)
		)
		.all();
	return rows.some((row) => row.id !== except);
}

export function createCategory(db: Db, input: { name: string; kind: Category['kind'] }): Category {
	if (nameTaken(db, input.kind, input.name)) throw new DuplicateNameError();
	const last = db
		.select({ max: sql<number>`coalesce(max(${categories.sortOrder}), -1)` })
		.from(categories)
		.get();
	const used = db.select({ n: count() }).from(categories).get()?.n ?? 0;
	const [row] = db
		.insert(categories)
		.values({ ...input, color: String((used % 8) + 1), sortOrder: (last?.max ?? -1) + 1 })
		.returning()
		.all();
	if (!row) throw new Error('The category was not created.');
	return row;
}

export function renameCategory(db: Db, id: string, name: string): Category | undefined {
	const current = db.select().from(categories).where(eq(categories.id, id)).get();
	if (!current) return undefined;
	if (nameTaken(db, current.kind, name, id)) throw new DuplicateNameError();
	return db.update(categories).set({ name }).where(eq(categories.id, id)).returning().get();
}

export function setCategoryArchived(db: Db, id: string, archived: boolean): boolean {
	return db.update(categories).set({ archived }).where(eq(categories.id, id)).run().changes > 0;
}

/** How many live transactions use each category, for the categories page. */
export function categoryUsage(db: Db): Map<string, number> {
	const rows = db
		.select({ id: transactionLegs.categoryId, n: count() })
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(isNull(transactions.deletedAt))
		.groupBy(transactionLegs.categoryId)
		.all();
	return new Map(rows.filter((row) => row.id !== null).map((row) => [row.id as string, row.n]));
}
