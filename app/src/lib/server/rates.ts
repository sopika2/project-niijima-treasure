import {
	MNB_REQUEST,
	otpRatesUrl,
	parseMnbRates,
	parseOtpRates,
	type RateQuote
} from '@treasure/core';
import { backfillBaseAmounts, foreignCurrencies, insertRates, type Treasury } from '@treasure/db';
import { log, logError } from './log.ts';
import { localDay } from './snapshots.ts';

type Source = 'otp' | 'mnb';

export interface RateStatus {
	readonly lastAttempt: string | null;
	readonly lastSuccess: string | null;
	readonly source: Source | null;
	readonly problem: string | null;
}

export interface RateSettings {
	readonly treasury: Treasury;
	readonly base: string;
	readonly timezone: string;
	readonly primary: Source;
	readonly fallback: Source | 'none';
	readonly enabled: boolean;
	/** Swappable for tests. */
	readonly fetch?: typeof fetch;
}

const TIMEOUT = 15_000;

/** Fetches OTP's and the MNB's published rates and keeps them in the database. */
export class RateService {
	readonly #settings: RateSettings;
	readonly #fetch: typeof fetch;
	#status: RateStatus = { lastAttempt: null, lastSuccess: null, source: null, problem: null };
	#running: Promise<number> | null = null;

	constructor(settings: RateSettings) {
		this.#settings = settings;
		this.#fetch = settings.fetch ?? fetch;
	}

	status(): RateStatus {
		return this.#status;
	}

	async #otp(currencies: readonly string[]): Promise<RateQuote[]> {
		const { day } = localDay(this.#settings.timezone);
		const from = localDay(this.#settings.timezone, new Date(Date.now() - 6 * 86_400_000)).day;
		const quotes: RateQuote[] = [];
		for (const currency of currencies) {
			const response = await this.#fetch(otpRatesUrl(currency, from, day), {
				headers: { accept: 'application/json' },
				signal: AbortSignal.timeout(TIMEOUT)
			});
			if (!response.ok) throw new Error(`OTP answered ${response.status} for ${currency}.`);
			quotes.push(...parseOtpRates(await response.json()));
		}
		return quotes;
	}

	async #mnb(currencies: readonly string[]): Promise<RateQuote[]> {
		const response = await this.#fetch(MNB_REQUEST.url, {
			method: 'POST',
			headers: MNB_REQUEST.headers,
			body: MNB_REQUEST.body,
			signal: AbortSignal.timeout(TIMEOUT)
		});
		if (!response.ok) throw new Error(`MNB answered ${response.status}.`);
		return parseMnbRates(await response.text()).filter((quote) =>
			currencies.includes(quote.currency)
		);
	}

	/** Fetches now. Returns how many new quotes were stored. Never throws. */
	refresh(): Promise<number> {
		this.#running ??= this.#refresh().finally(() => (this.#running = null));
		return this.#running;
	}

	async #refresh(): Promise<number> {
		const { treasury, base, primary, fallback, enabled } = this.#settings;
		if (!enabled || base !== 'HUF') return 0;
		const currencies = foreignCurrencies(treasury.db, base);
		if (currencies.length === 0) return 0;

		const now = new Date().toISOString();
		const order = [primary, ...(fallback !== 'none' && fallback !== primary ? [fallback] : [])];
		const problems: string[] = [];
		for (const source of order) {
			try {
				const quotes = source === 'otp' ? await this.#otp(currencies) : await this.#mnb(currencies);
				if (quotes.length === 0) throw new Error(`${source.toUpperCase()} returned no rates.`);
				const added = insertRates(treasury.db, quotes);
				const filled = backfillBaseAmounts(treasury.db, base);
				this.#status = { lastAttempt: now, lastSuccess: now, source, problem: null };
				log(
					'rates',
					`${source.toUpperCase()}: ${added} new quotes for ${currencies.join(', ')}${filled ? `, filled ${filled} entries` : ''}`
				);
				return added;
			} catch (error) {
				problems.push(`${source.toUpperCase()}: ${error instanceof Error ? error.message : error}`);
			}
		}
		this.#status = { ...this.#status, lastAttempt: now, problem: problems.join(' ') };
		logError('rates', problems.join(' '));
		return 0;
	}

	/** Uses a rate you typed in, until the next fetched one is newer. */
	addManual(currency: string, rate: string): number {
		const added = insertRates(this.#settings.treasury.db, [
			{
				currency,
				quoteCurrency: this.#settings.base,
				rateType: 'middle',
				rate,
				validFrom: new Date().toISOString(),
				source: 'manual'
			}
		]);
		backfillBaseAmounts(this.#settings.treasury.db, this.#settings.base);
		return added;
	}
}
