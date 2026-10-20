import { convert, money, type RateQuote } from '@treasure/core';
import { and, asc, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { exchangeRates, transactionLegs, transactions, type ExchangeRate } from '../schema.ts';

/** Rate types that say what a currency is worth (as opposed to what a bank charges to swap it). */
const VALUATION: ExchangeRate['rateType'][] = ['middle', 'official'];

/** Stores quotes; ones already stored are skipped. Returns how many were new. */
export function insertRates(db: Db, quotes: readonly RateQuote[]): number {
	if (quotes.length === 0) return 0;
	let added = 0;
	db.transaction((tx) => {
		for (const quote of quotes) {
			const result = tx
				.insert(exchangeRates)
				.values({
					currency: quote.currency,
					quoteCurrency: quote.quoteCurrency,
					rateType: quote.rateType,
					rate: quote.rate,
					validFrom: quote.validFrom,
					source: quote.source
				})
				.onConflictDoNothing()
				.run();
			added += result.changes;
		}
	});
	return added;
}

/**
 * What one unit of `currency` was worth in `quoteCurrency` at `at` (ISO timestamp): the newest
 * middle or official quote from any source, valid at that moment.
 */
export function valuationRate(
	db: Db,
	currency: string,
	quoteCurrency: string,
	at: string = new Date().toISOString()
): ExchangeRate | undefined {
	return db
		.select()
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.currency, currency),
				eq(exchangeRates.quoteCurrency, quoteCurrency),
				inArray(exchangeRates.rateType, VALUATION),
				lte(exchangeRates.validFrom, at)
			)
		)
		.orderBy(desc(exchangeRates.validFrom), desc(exchangeRates.fetchedAt))
		.limit(1)
		.get();
}

/** @deprecated name kept for older callers; use valuationRate. */
export const latestMiddleRate = valuationRate;

/** When the newest stored rate was fetched, or null if there are none yet. */
export function ratesFreshness(db: Db): string | null {
	const row = db
		.select({ fetchedAt: exchangeRates.fetchedAt })
		.from(exchangeRates)
		.orderBy(desc(exchangeRates.fetchedAt))
		.limit(1)
		.get();
	return row?.fetchedAt ?? null;
}

export interface CurrentRate {
	readonly currency: string;
	readonly value: ExchangeRate | undefined;
	readonly buy: ExchangeRate | undefined;
	readonly sell: ExchangeRate | undefined;
}

function latestOfType(db: Db, currency: string, base: string, type: ExchangeRate['rateType']) {
	return db
		.select()
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.currency, currency),
				eq(exchangeRates.quoteCurrency, base),
				eq(exchangeRates.rateType, type)
			)
		)
		.orderBy(desc(exchangeRates.validFrom))
		.limit(1)
		.get();
}

/** The latest value, buy and sell rate per currency, for the rates table. */
export function currentRates(db: Db, currencies: readonly string[], base: string): CurrentRate[] {
	return currencies.map((currency) => ({
		currency,
		value: valuationRate(db, currency, base),
		buy: latestOfType(db, currency, base, 'account_buy'),
		sell: latestOfType(db, currency, base, 'account_sell')
	}));
}

/** Daily value of a currency over a period, for the rate chart: the last quote of each day. */
export function rateHistory(
	db: Db,
	currency: string,
	base: string,
	from: string,
	to: string
): Array<{ day: string; rate: string }> {
	const rows = db
		.select({ validFrom: exchangeRates.validFrom, rate: exchangeRates.rate })
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.currency, currency),
				eq(exchangeRates.quoteCurrency, base),
				inArray(exchangeRates.rateType, VALUATION),
				sql`substr(${exchangeRates.validFrom}, 1, 10) between ${from} and ${to}`
			)
		)
		.orderBy(asc(exchangeRates.validFrom))
		.all();
	const byDay = new Map<string, string>();
	for (const row of rows) byDay.set(row.validFrom.slice(0, 10), row.rate);
	return [...byDay].map(([day, rate]) => ({ day, rate }));
}

/**
 * Fills in the base-currency value of foreign entries that were saved before any rate was known,
 * using the rate valid on their date (or the earliest known rate, if they are older than all
 * rates). Returns how many entries were filled.
 */
export function backfillBaseAmounts(db: Db, base: string): number {
	const missing = db
		.select({
			id: transactionLegs.id,
			amount: transactionLegs.amountMinor,
			currency: transactionLegs.currency,
			date: transactions.date
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(isNull(transactionLegs.baseAmountMinor), ne(transactionLegs.currency, base)))
		.all();

	let filled = 0;
	db.transaction((tx) => {
		for (const leg of missing) {
			const rate =
				valuationRate(tx as unknown as Db, leg.currency, base, `${leg.date}T23:59:59.999Z`) ??
				tx
					.select()
					.from(exchangeRates)
					.where(
						and(
							eq(exchangeRates.currency, leg.currency),
							eq(exchangeRates.quoteCurrency, base),
							inArray(exchangeRates.rateType, VALUATION)
						)
					)
					.orderBy(asc(exchangeRates.validFrom))
					.limit(1)
					.get();
			if (!rate) continue;
			const value = convert(money(leg.amount, leg.currency), {
				from: leg.currency,
				to: base,
				rate: rate.rate
			});
			tx.update(transactionLegs)
				.set({ baseAmountMinor: value.amount, rate: rate.rate, rateId: rate.id })
				.where(eq(transactionLegs.id, leg.id))
				.run();
			filled += 1;
		}
	});
	return filled;
}

/** Currencies of accounts and entries that are not the base currency. */
/** Foreign currencies in use that have no rate to `base` stored at all. */
export function currenciesWithoutRates(db: Db, base: string): string[] {
	return foreignCurrencies(db, base).filter(
		(currency) =>
			!db
				.select({ id: exchangeRates.id })
				.from(exchangeRates)
				.where(
					and(
						eq(exchangeRates.currency, currency),
						eq(exchangeRates.quoteCurrency, base),
						inArray(exchangeRates.rateType, VALUATION)
					)
				)
				.limit(1)
				.get()
	);
}

export function foreignCurrencies(db: Db, base: string): string[] {
	const rows = db.all<{ currency: string }>(
		sql`select currency from accounts where currency != ${base} union select currency from transaction_legs where currency != ${base} order by currency`
	);
	return rows.map((row) => row.currency);
}
