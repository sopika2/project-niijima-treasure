import { currency } from './currency.ts';
import { money, MoneyError, type Money } from './money.ts';

/**
 * An exchange rate as published, kept as exact decimal text: units of `to` for one unit of `from`.
 * OTP's EUR rate of 395.12 is `{ from: 'EUR', to: 'HUF', rate: '395.12' }`.
 */
export interface Rate {
	readonly from: string;
	readonly to: string;
	readonly rate: string;
}

const DECIMAL = /^\d+(\.\d+)?$/;

function parseDecimal(text: string): { digits: bigint; scale: number } {
	const trimmed = text.trim().replace(',', '.');
	if (!DECIMAL.test(trimmed)) throw new MoneyError(`"${text}" is not a valid rate.`);
	const [whole = '0', fraction = ''] = trimmed.split('.');
	return { digits: BigInt(whole + fraction), scale: fraction.length };
}

/** Divide and round half away from zero, the way banks round a converted amount. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
	const negative = numerator < 0n !== denominator < 0n;
	const n = numerator < 0n ? -numerator : numerator;
	const d = denominator < 0n ? -denominator : denominator;
	const quotient = (n * 2n + d) / (d * 2n);
	return negative ? -quotient : quotient;
}

/** Converts an amount with an exact decimal rate, rounding once at the end. */
export function convert(amount: Money, rate: Rate): Money {
	if (amount.currency === rate.to && rate.from === rate.to) return amount;
	if (amount.currency !== rate.from) {
		throw new MoneyError(`Rate converts ${rate.from}, but the amount is in ${amount.currency}.`);
	}
	const fromDecimals = currency(rate.from).decimals;
	const toDecimals = currency(rate.to).decimals;
	const { digits, scale } = parseDecimal(rate.rate);
	if (digits === 0n) throw new MoneyError('A rate of zero cannot convert anything.');

	const numerator = BigInt(amount.amount) * digits * 10n ** BigInt(toDecimals);
	const denominator = 10n ** BigInt(scale + fromDecimals);
	const result = divideRounded(numerator, denominator);
	if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new MoneyError('Converted amount is too large to store.');
	}
	return money(Number(result), rate.to);
}

/** The rate implied by two real amounts, e.g. a transfer where both legs are known. */
export function impliedRate(from: Money, to: Money, scale = 6): Rate {
	if (from.amount === 0) throw new MoneyError('Cannot work out a rate from a zero amount.');
	const fromDecimals = currency(from.currency).decimals;
	const toDecimals = currency(to.currency).decimals;
	const numerator = BigInt(to.amount) * 10n ** BigInt(fromDecimals + scale);
	const denominator = BigInt(from.amount) * 10n ** BigInt(toDecimals);
	const scaled = divideRounded(numerator, denominator);
	const negative = scaled < 0n;
	const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, '0');
	const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
	return { from: from.currency, to: to.currency, rate: negative ? `-${text}` : text };
}
