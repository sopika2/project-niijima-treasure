import {
	convert,
	LedgerError,
	money,
	toDecimalString,
	type AccountInfo,
	type CategoryInfo,
	type FieldErrors,
	type LedgerContext
} from '@treasure/core';
import {
	latestMiddleRate,
	listAccounts,
	listCategories,
	owners,
	scopeFor,
	type Account,
	type Category,
	type Owner,
	type Scope,
	type StoredTransaction
} from '@treasure/db';
import type { AccountOption, CategoryOption, TransactionRow } from '../types.ts';
import type { Runtime } from './runtime.ts';

export type { AccountOption, CategoryOption, TransactionRow };
import { localDay } from './snapshots.ts';

/** Today and this month in the configured time zone. */
export function today(app: Runtime): { day: string; month: string } {
	return localDay(app.config.timezone);
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: string | null | undefined): value is string {
	return !!value && MONTH.test(value);
}

/** First and last day of a month, YYYY-MM-DD. */
export function monthRange(month: string): { from: string; to: string } {
	const [year, number] = month.split('-').map(Number) as [number, number];
	const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
	return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(month: string, by: number): string {
	const [year, number] = month.split('-').map(Number) as [number, number];
	const date = new Date(Date.UTC(year, number - 1 + by, 1));
	return date.toISOString().slice(0, 7);
}

/** Everything the transaction rules need to know about accounts, categories and rates. */
export function ledgerContext(app: Runtime, allowArchived?: ReadonlySet<string>): LedgerContext {
	const { db } = app.treasury;
	const base = app.config.base_currency;
	return {
		accounts: new Map(
			listAccounts(db, { includeArchived: true }).map((account): [string, AccountInfo] => [
				account.id,
				account
			])
		),
		categories: new Map(
			listCategories(db, { includeArchived: true }).map((category): [string, CategoryInfo] => [
				category.id,
				category
			])
		),
		baseCurrency: base,
		rateFor: (currency, date) =>
			latestMiddleRate(db, currency, base, `${date}T23:59:59.999Z`)?.rate ?? null,
		allowArchived
	};
}

/** What a sister sees: her own accounts, budgets and Treasures, plus the shared ones. */
export function scopeOf(locals: App.Locals): Scope {
	return scopeFor(locals.persona);
}

/** The owner picked on a form; anything else means the sister using it. */
export function ownerOf(form: FormData, locals: App.Locals): Owner {
	const value = form.get('owner');
	return owners.find((owner) => owner === value) ?? locals.persona;
}

export function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

/** Field error codes for the form, or rethrows anything that isn't a validation problem. */
export function fieldErrors(error: unknown): FieldErrors {
	if (error instanceof LedgerError) return error.fields;
	throw error;
}

/* ── What the screens show ───────────────────────────────────────────────── */

export function accountOption(account: Account): AccountOption {
	return {
		id: account.id,
		name: account.name,
		type: account.type,
		currency: account.currency,
		openingDate: account.openingDate
	};
}

export function categoryOption(category: Category): CategoryOption {
	const color = Number(category.color);
	return {
		id: category.id,
		name: category.name,
		kind: category.kind,
		color: Number.isInteger(color) && color > 0 ? color : 8
	};
}

export function transactionRow(
	transaction: StoredTransaction,
	accounts: ReadonlyMap<string, Account>,
	categories: ReadonlyMap<string, Category>
): TransactionRow {
	const [first, second] = transaction.legs;
	const category = first?.categoryId ? categories.get(first.categoryId) : undefined;
	const accountName = (id: string | undefined) => (id ? (accounts.get(id)?.name ?? '?') : '?');
	return {
		id: transaction.id,
		date: transaction.date,
		kind: transaction.kind,
		note: transaction.note,
		amount: first?.amountMinor ?? 0,
		currency: first?.currency ?? '',
		account: accountName(first?.accountId),
		toAccount: transaction.kind === 'transfer' ? accountName(second?.accountId) : null,
		toAmount: transaction.kind === 'transfer' ? (second?.amountMinor ?? null) : null,
		toCurrency: transaction.kind === 'transfer' ? (second?.currency ?? null) : null,
		category: category ? { name: category.name, color: categoryOption(category).color } : null
	};
}

export function lookup(app: Runtime) {
	const { db } = app.treasury;
	return {
		accounts: new Map(listAccounts(db, { includeArchived: true }).map((row) => [row.id, row])),
		categories: new Map(listCategories(db, { includeArchived: true }).map((row) => [row.id, row]))
	};
}

/**
 * An amount in the base currency at a date's rate (or the latest rate), or null when no rate is
 * known for that currency yet.
 */
export function toBase(
	app: Runtime,
	amountMinor: number,
	currency: string,
	date?: string
): number | null {
	const base = app.config.base_currency;
	if (currency === base) return amountMinor;
	const rate =
		latestMiddleRate(app.treasury.db, currency, base, date ? `${date}T23:59:59.999Z` : undefined) ??
		latestMiddleRate(app.treasury.db, currency, base);
	if (!rate) return null;
	return convert(money(amountMinor, currency), { from: currency, to: base, rate: rate.rate })
		.amount;
}

/** Whole minor units as text the transaction rules accept, e.g. 450000 HUF → "4500". */
export function typedAmount(amountMinor: number, currency: string): string {
	return toDecimalString(money(Math.abs(amountMinor), currency));
}
