import { convert, impliedRate } from './convert.ts';
import { currency as currencyInfo } from './currency.ts';
import { money, parseMoney } from './money.ts';

export type TransactionKind = 'income' | 'expense' | 'transfer';
export const transactionKinds: readonly TransactionKind[] = ['income', 'expense', 'transfer'];

/**
 * Why an input was rejected. Codes, not sentences: the words people see live in style.yml
 * under copy.errors.
 */
export type LedgerErrorCode =
	| 'required'
	| 'invalid_amount'
	| 'not_positive'
	| 'too_large'
	| 'invalid_date'
	| 'unknown_account'
	| 'archived_account'
	| 'unknown_category'
	| 'wrong_category'
	| 'same_account'
	| 'to_amount_required'
	| 'unknown_currency';

export type FieldErrors = Partial<Record<string, LedgerErrorCode>>;

export class LedgerError extends Error {
	readonly fields: FieldErrors;
	constructor(fields: FieldErrors) {
		super(
			`Invalid input: ${Object.entries(fields)
				.map(([field, code]) => `${field} ${code}`)
				.join(', ')}`
		);
		this.name = 'LedgerError';
		this.fields = fields;
	}
}

export interface AccountInfo {
	readonly id: string;
	readonly currency: string;
	readonly archived: boolean;
}

export interface CategoryInfo {
	readonly id: string;
	readonly kind: 'income' | 'expense';
	readonly archived: boolean;
}

/** What someone typed into the transaction form, still as text. */
export interface TransactionForm {
	readonly kind: string;
	readonly date: string;
	readonly amount: string;
	readonly accountId: string;
	readonly categoryId?: string | null;
	readonly toAccountId?: string | null;
	/** Only for a transfer between accounts in different currencies. */
	readonly toAmount?: string | null;
	readonly note?: string | null;
}

/** One entry on one account. Money leaving the account is negative. */
export interface PlannedLeg {
	readonly accountId: string;
	readonly amountMinor: number;
	readonly currency: string;
	readonly categoryId: string | null;
	/** The same amount in the base currency, or null while no exchange rate is known. */
	readonly baseAmountMinor: number | null;
	/** The exact rate behind baseAmountMinor; null when the leg is already in the base currency. */
	readonly rate: string | null;
}

export interface PlannedTransaction {
	readonly kind: TransactionKind;
	readonly date: string;
	readonly note: string | null;
	readonly legs: readonly PlannedLeg[];
}

export interface LedgerContext {
	readonly accounts: ReadonlyMap<string, AccountInfo>;
	readonly categories: ReadonlyMap<string, CategoryInfo>;
	readonly baseCurrency: string;
	/** Units of the base currency for one unit of `currency` on `date`, or null if unknown. */
	readonly rateFor: (currency: string, date: string) => string | null;
	/** When editing, the account the transaction already uses may stay even if archived since. */
	readonly allowArchived?: ReadonlySet<string>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
	if (!DATE.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Reads a typed amount for a currency; records an error code instead of throwing. */
function readAmount(
	text: string | null | undefined,
	currencyCode: string,
	field: string,
	errors: FieldErrors
): number | null {
	if (!text || !text.trim()) {
		errors[field] = 'required';
		return null;
	}
	try {
		const { amount } = parseMoney(text, currencyCode);
		if (amount <= 0) {
			errors[field] = 'not_positive';
			return null;
		}
		if (amount > 1e15) {
			errors[field] = 'too_large';
			return null;
		}
		return amount;
	} catch {
		errors[field] = 'invalid_amount';
		return null;
	}
}

function baseValue(
	amountMinor: number,
	currencyCode: string,
	date: string,
	context: LedgerContext
): { base: number | null; rate: string | null } {
	if (currencyCode === context.baseCurrency) return { base: amountMinor, rate: null };
	const rate = context.rateFor(currencyCode, date);
	if (!rate) return { base: null, rate: null };
	const converted = convert(money(amountMinor, currencyCode), {
		from: currencyCode,
		to: context.baseCurrency,
		rate
	});
	return { base: converted.amount, rate };
}

/**
 * Checks a transaction form and turns it into the account entries to store.
 *
 * - Income adds to one account, expense takes from one account.
 * - A transfer takes from one account and adds to another. Between currencies, both real
 *   amounts are given, so the rate is exactly what the bank used; when one side is in the
 *   base currency, that side decides the base value of both, so a transfer never counts as
 *   spending or income.
 *
 * Throws LedgerError with a code per field.
 */
export function planTransaction(form: TransactionForm, context: LedgerContext): PlannedTransaction {
	const errors: FieldErrors = {};
	const kind = transactionKinds.find((value) => value === form.kind);
	if (!kind) errors.kind = 'required';

	const date = form.date.trim();
	if (!isIsoDate(date)) errors.date = 'invalid_date';

	const usable = (id: string | null | undefined, field: string): AccountInfo | null => {
		const account = id ? context.accounts.get(id) : undefined;
		if (!account) {
			errors[field] = 'unknown_account';
			return null;
		}
		if (account.archived && !context.allowArchived?.has(account.id)) {
			errors[field] = 'archived_account';
			return null;
		}
		return account;
	};

	const account = usable(form.accountId, 'accountId');
	const amount = account ? readAmount(form.amount, account.currency, 'amount', errors) : null;
	const note = form.note?.trim() ? form.note.trim().slice(0, 500) : null;

	if (kind === 'transfer') {
		const target = usable(form.toAccountId, 'toAccountId');
		if (account && target && account.id === target.id) errors.toAccountId = 'same_account';

		let toAmount: number | null = null;
		if (account && target && amount !== null && account.id !== target.id) {
			if (account.currency === target.currency) toAmount = amount;
			else if (!form.toAmount?.trim()) errors.toAmount = 'to_amount_required';
			else toAmount = readAmount(form.toAmount, target.currency, 'toAmount', errors);
		}
		if (
			Object.keys(errors).length > 0 ||
			!account ||
			!target ||
			amount === null ||
			toAmount === null
		) {
			throw new LedgerError(errors);
		}

		let out = baseValue(amount, account.currency, date, context);
		let into = baseValue(toAmount, target.currency, date, context);
		if (account.currency === context.baseCurrency && target.currency !== context.baseCurrency) {
			into = {
				base: amount,
				rate: impliedRateText(toAmount, target.currency, amount, context.baseCurrency)
			};
		} else if (
			target.currency === context.baseCurrency &&
			account.currency !== context.baseCurrency
		) {
			out = {
				base: toAmount,
				rate: impliedRateText(amount, account.currency, toAmount, context.baseCurrency)
			};
		}
		return {
			kind,
			date,
			note,
			legs: [
				{
					accountId: account.id,
					amountMinor: -amount,
					currency: account.currency,
					categoryId: null,
					baseAmountMinor: out.base === null ? null : -out.base,
					rate: out.rate
				},
				{
					accountId: target.id,
					amountMinor: toAmount,
					currency: target.currency,
					categoryId: null,
					baseAmountMinor: into.base,
					rate: into.rate
				}
			]
		};
	}

	let categoryId: string | null = null;
	if (form.categoryId) {
		const category = context.categories.get(form.categoryId);
		if (!category) errors.categoryId = 'unknown_category';
		else if (kind && category.kind !== kind) errors.categoryId = 'wrong_category';
		else categoryId = category.id;
	}

	if (Object.keys(errors).length > 0 || !kind || !account || amount === null) {
		throw new LedgerError(errors);
	}

	const sign = kind === 'expense' ? -1 : 1;
	const { base, rate } = baseValue(amount, account.currency, date, context);
	return {
		kind,
		date,
		note,
		legs: [
			{
				accountId: account.id,
				amountMinor: sign * amount,
				currency: account.currency,
				categoryId,
				baseAmountMinor: base === null ? null : sign * base,
				rate
			}
		]
	};
}

/** Units of the base currency per unit of the foreign one, worked out exactly from two real amounts. */
function impliedRateText(
	foreignMinor: number,
	foreignCurrency: string,
	baseMinor: number,
	baseCurrency: string
): string {
	return impliedRate(money(foreignMinor, foreignCurrency), money(baseMinor, baseCurrency)).rate;
}

/** Checks the account form. Returns clean values or throws LedgerError. */
export interface AccountForm {
	readonly name: string;
	readonly type: string;
	readonly currency: string;
	readonly openingBalance: string;
	readonly openingDate: string;
	readonly includeInTotal: boolean;
}

export const accountTypes = ['current', 'savings', 'cash', 'card', 'other'] as const;
export type AccountType = (typeof accountTypes)[number];

export interface CleanAccount {
	readonly name: string;
	readonly type: AccountType;
	readonly currency: string;
	readonly openingBalanceMinor: number;
	readonly openingDate: string;
	readonly includeInTotal: boolean;
}

export function checkAccount(form: AccountForm): CleanAccount {
	const errors: FieldErrors = {};
	const name = form.name.trim().slice(0, 60);
	if (!name) errors.name = 'required';
	const type = accountTypes.find((value) => value === form.type);
	if (!type) errors.type = 'required';
	let currencyCode = form.currency.trim().toUpperCase();
	try {
		currencyInfo(currencyCode);
	} catch {
		errors.currency = 'unknown_currency';
		currencyCode = '';
	}
	let opening = 0;
	if (form.openingBalance.trim() && currencyCode) {
		try {
			opening = parseMoney(form.openingBalance, currencyCode).amount;
		} catch {
			errors.openingBalance = 'invalid_amount';
		}
	}
	const openingDate = form.openingDate.trim();
	if (!isIsoDate(openingDate)) errors.openingDate = 'invalid_date';

	if (Object.keys(errors).length > 0 || !type) throw new LedgerError(errors);
	return {
		name,
		type,
		currency: currencyCode,
		openingBalanceMinor: opening,
		openingDate,
		includeInTotal: form.includeInTotal
	};
}

export function checkCategoryName(value: string): string {
	const name = value.trim().slice(0, 40);
	if (!name) throw new LedgerError({ name: 'required' });
	return name;
}
