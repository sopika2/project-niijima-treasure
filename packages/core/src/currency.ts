/**
 * Currencies the app knows how to store and show.
 *
 * `decimals` is the ISO 4217 minor unit: how amounts are stored (HUF in fillér, EUR in cents).
 * `displayDecimals` is how many of those decimals are shown; HUF is shown in whole forints.
 * `symbolAfter` marks currencies whose symbol is written after the amount ("12,480 Ft"), even in
 * a language like English that would otherwise put it first.
 */
export interface CurrencyInfo {
	readonly code: string;
	readonly decimals: number;
	readonly displayDecimals: number;
	readonly symbolAfter?: boolean;
}

const KNOWN: Record<string, CurrencyInfo> = {
	HUF: { code: 'HUF', decimals: 2, displayDecimals: 0, symbolAfter: true },
	EUR: { code: 'EUR', decimals: 2, displayDecimals: 2 },
	USD: { code: 'USD', decimals: 2, displayDecimals: 2 },
	GBP: { code: 'GBP', decimals: 2, displayDecimals: 2 },
	CHF: { code: 'CHF', decimals: 2, displayDecimals: 2 },
	PLN: { code: 'PLN', decimals: 2, displayDecimals: 2, symbolAfter: true },
	CZK: { code: 'CZK', decimals: 2, displayDecimals: 2, symbolAfter: true },
	RON: { code: 'RON', decimals: 2, displayDecimals: 2, symbolAfter: true },
	JPY: { code: 'JPY', decimals: 0, displayDecimals: 0 }
};

const CODE = /^[A-Z]{3}$/;

export class UnknownCurrencyError extends Error {
	constructor(code: string) {
		super(`Unknown currency "${code}". Known: ${Object.keys(KNOWN).join(', ')}.`);
		this.name = 'UnknownCurrencyError';
	}
}

export function isCurrencyCode(code: string): boolean {
	return CODE.test(code) && code in KNOWN;
}

export function currency(code: string): CurrencyInfo {
	const info = KNOWN[code];
	if (!info) throw new UnknownCurrencyError(code);
	return info;
}

export function knownCurrencies(): readonly CurrencyInfo[] {
	return Object.values(KNOWN);
}
