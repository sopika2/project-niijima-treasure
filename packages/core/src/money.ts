import { currency } from './currency.ts';

/**
 * An amount of money in one currency, stored as a whole number of minor units
 * (fillér, cents). Never a floating-point number, so totals never drift.
 */
export interface Money {
	readonly amount: number;
	readonly currency: string;
}

export class MoneyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MoneyError';
	}
}

function assertMinor(amount: number): void {
	if (!Number.isSafeInteger(amount)) {
		throw new MoneyError(`Amount must be a whole number of minor units, got ${amount}.`);
	}
}

export function money(amount: number, code: string): Money {
	assertMinor(amount);
	currency(code);
	return { amount: amount === 0 ? 0 : amount, currency: code };
}

export function zero(code: string): Money {
	return money(0, code);
}

function sameCurrency(a: Money, b: Money): void {
	if (a.currency !== b.currency) {
		throw new MoneyError(`Cannot combine ${a.currency} and ${b.currency} without a rate.`);
	}
}

export function add(a: Money, b: Money): Money {
	sameCurrency(a, b);
	return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
	sameCurrency(a, b);
	return money(a.amount - b.amount, a.currency);
}

export function negate(a: Money): Money {
	return money(-a.amount, a.currency);
}

export function sum(items: readonly Money[], code: string): Money {
	return items.reduce((total, item) => add(total, item), zero(code));
}

export function isZero(a: Money): boolean {
	return a.amount === 0;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
	sameCurrency(a, b);
	return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

/** Exact decimal text of an amount in major units, e.g. 123456 HUF minor → "1234.56". */
export function toDecimalString(a: Money): string {
	const { decimals } = currency(a.currency);
	const negative = a.amount < 0;
	const digits = Math.abs(a.amount)
		.toString()
		.padStart(decimals + 1, '0');
	const whole = decimals === 0 ? digits : digits.slice(0, -decimals);
	const fraction = decimals === 0 ? '' : `.${digits.slice(-decimals)}`;
	return `${negative ? '-' : ''}${whole}${fraction}`;
}

const SPACES = /[\s\u00a0\u202f']/g;
const SYMBOLS = /[^\d.,-]/g;

/**
 * Reads an amount the way people type it: "1 234,56", "1234.56", "1,234.56", "-15" or "4 500 Ft".
 *
 * When both "," and "." appear, the last one is the decimal separator. A single separator
 * followed by exactly three digits is read as a thousands separator when the currency has
 * fewer than three decimals ("1,500" HUF is fifteen hundred).
 */
export function parseMoney(input: string, code: string): Money {
	const { decimals } = currency(code);
	const cleaned = input.replace(SPACES, '').replace(SYMBOLS, '');
	const negative = cleaned.startsWith('-');
	const body = negative ? cleaned.slice(1) : cleaned;

	if (body === '' || body.includes('-') || !/\d/.test(body)) {
		throw new MoneyError(`"${input}" is not an amount.`);
	}

	const lastComma = body.lastIndexOf(',');
	const lastDot = body.lastIndexOf('.');
	let decimalSeparator: ',' | '.' | null = null;

	if (lastComma >= 0 && lastDot >= 0) {
		decimalSeparator = lastComma > lastDot ? ',' : '.';
	} else if (lastComma >= 0 || lastDot >= 0) {
		const separator = lastComma >= 0 ? ',' : '.';
		const occurrences = body.split(separator).length - 1;
		const after = body.length - body.lastIndexOf(separator) - 1;
		const looksLikeThousands = occurrences > 1 || (after === 3 && decimals < 3);
		decimalSeparator = looksLikeThousands ? null : separator;
	}

	let whole = body;
	let fraction = '';
	if (decimalSeparator) {
		const at = body.lastIndexOf(decimalSeparator);
		whole = body.slice(0, at);
		fraction = body.slice(at + 1);
	}

	// Thousands groups must look like thousands: "1.234.567", never "1.2.3".
	const groups = whole.split(/[.,]/);
	const groupsValid =
		groups.length === 1 ||
		(/^\d{1,3}$/.test(groups[0] ?? '') && groups.slice(1).every((group) => /^\d{3}$/.test(group)));
	const thousandsMixed = decimalSeparator !== null && whole.includes(decimalSeparator);
	whole = groups.join('');

	if (!groupsValid || thousandsMixed || !/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) {
		throw new MoneyError(`"${input}" is not an amount.`);
	}
	if (fraction.length > decimals) {
		throw new MoneyError(`${code} has ${decimals} decimal places; "${input}" has more.`);
	}

	const minor = Number((whole || '0') + fraction.padEnd(decimals, '0'));
	return money(negative ? -minor : minor, code);
}

export interface FormatOptions {
	readonly locale: string;
	/** Show the currency symbol or code. Default true. */
	readonly symbol?: boolean;
	/** Always show a sign, e.g. "+4 500 Ft" for income. Default false. */
	readonly signed?: boolean;
	/** Override how many decimals to show; defaults to the currency's display decimals. */
	readonly decimals?: number;
}

export function formatMoney(a: Money, options: FormatOptions): string {
	const info = currency(a.currency);
	const shown = options.decimals ?? info.displayDecimals;
	const formatter = new Intl.NumberFormat(options.locale, {
		style: options.symbol === false ? 'decimal' : 'currency',
		currency: a.currency,
		currencyDisplay: 'narrowSymbol',
		minimumFractionDigits: shown,
		maximumFractionDigits: shown,
		signDisplay: options.signed ? 'exceptZero' : 'auto'
	});
	// Format the exact decimal string, not a float, so large amounts never round wrongly.
	const value = toDecimalString(a) as `${number}`;
	if (!info.symbolAfter || options.symbol === false) return formatter.format(value);
	// Forints and the like: "-12,480 Ft", not "-Ft 12,480", whatever the language puts first.
	const parts = formatter.formatToParts(value);
	const at = parts.findIndex((part) => part.type === 'currency');
	const firstDigit = parts.findIndex((part) => part.type === 'integer');
	if (at < 0 || at > firstDigit) return formatter.format(value);
	const symbol = parts[at]!.value;
	const rest = parts.filter(
		(_, index) => index !== at && !(index === at + 1 && parts[index]!.type === 'literal')
	);
	return `${rest.map((part) => part.value).join('')}\u00a0${symbol}`;
}
