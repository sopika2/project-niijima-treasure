import { and, desc, eq, lte } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { exchangeRates, type ExchangeRate } from '../schema.ts';

/** The most recent middle rate for a currency, valid at `at` (ISO timestamp). */
export function latestMiddleRate(
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
				eq(exchangeRates.rateType, 'middle'),
				lte(exchangeRates.validFrom, at)
			)
		)
		.orderBy(desc(exchangeRates.validFrom))
		.limit(1)
		.get();
}

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
