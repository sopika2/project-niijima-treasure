import { planTransaction } from '@treasure/core';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../client.ts';
import { createAccount } from './catalog.ts';
import {
	backfillBaseAmounts,
	foreignCurrencies,
	insertRates,
	rateHistory,
	valuationRate
} from './rates.ts';
import { createTransaction, getTransaction } from './transactions.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;
const quote = (
	rate: string,
	validFrom: string,
	rateType: 'middle' | 'official' = 'middle',
	source: 'otp' | 'mnb' = 'otp'
) => ({
	currency: 'EUR',
	quoteCurrency: 'HUF',
	rateType,
	rate,
	validFrom,
	source
});

describe('exchange rates', () => {
	it('stores each quote once and picks the newest value valid at a moment', () => {
		const { db, close } = openDatabase({ path: ':memory:', migrationsFolder });
		expect(
			insertRates(db, [
				quote('390', '2026-10-01T08:00:00.000Z'),
				quote('395', '2026-10-10T08:00:00.000Z', 'official', 'mnb')
			])
		).toBe(2);
		expect(insertRates(db, [quote('390', '2026-10-01T08:00:00.000Z')])).toBe(0);
		expect(valuationRate(db, 'EUR', 'HUF', '2026-10-05T00:00:00.000Z')?.rate).toBe('390');
		expect(valuationRate(db, 'EUR', 'HUF')?.rate).toBe('395');
		expect(valuationRate(db, 'EUR', 'HUF', '2026-09-01T00:00:00.000Z')).toBeUndefined();
		expect(rateHistory(db, 'EUR', 'HUF', '2026-10-01', '2026-10-31')).toEqual([
			{ day: '2026-10-01', rate: '390' },
			{ day: '2026-10-10', rate: '395' }
		]);
		close();
	});

	it('fills in the forint value of foreign entries once rates arrive', () => {
		const { db, close } = openDatabase({ path: ':memory:', migrationsFolder });
		const eur = createAccount(db, {
			name: 'EUR',
			type: 'current',
			currency: 'EUR',
			openingBalanceMinor: 0,
			openingDate: '2026-10-01',
			includeInTotal: true
		});
		const id = createTransaction(
			db,
			planTransaction(
				{ kind: 'expense', date: '2026-10-05', amount: '10', accountId: eur.id },
				{
					accounts: new Map([[eur.id, eur]]),
					categories: new Map(),
					baseCurrency: 'HUF',
					rateFor: () => null
				}
			)
		);
		expect(foreignCurrencies(db, 'HUF')).toEqual(['EUR']);
		expect(getTransaction(db, id)?.legs[0]?.baseAmountMinor).toBeNull();
		insertRates(db, [
			quote('390', '2026-10-01T08:00:00.000Z'),
			quote('400', '2026-10-08T08:00:00.000Z')
		]);
		expect(backfillBaseAmounts(db, 'HUF')).toBe(1);
		expect(getTransaction(db, id)?.legs[0]).toMatchObject({
			baseAmountMinor: -390000,
			rate: '390'
		});
		expect(backfillBaseAmounts(db, 'HUF')).toBe(0);
		close();
	});
});
