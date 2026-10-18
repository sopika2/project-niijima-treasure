import { describe, expect, it } from 'vitest';
import {
	checkAccount,
	isIsoDate,
	LedgerError,
	planTransaction,
	type AccountInfo,
	type CategoryInfo,
	type LedgerContext,
	type TransactionForm
} from './ledger.ts';

const accounts = new Map<string, AccountInfo>([
	['otp', { id: 'otp', currency: 'HUF', archived: false }],
	['cash', { id: 'cash', currency: 'HUF', archived: false }],
	['eur', { id: 'eur', currency: 'EUR', archived: false }],
	['old', { id: 'old', currency: 'HUF', archived: true }]
]);
const categories = new Map<string, CategoryInfo>([
	['food', { id: 'food', kind: 'expense', archived: false }],
	['salary', { id: 'salary', kind: 'income', archived: false }]
]);
const context = (rate: string | null = null): LedgerContext => ({
	accounts,
	categories,
	baseCurrency: 'HUF',
	rateFor: () => rate
});

const base: TransactionForm = {
	kind: 'expense',
	date: '2026-10-18',
	amount: '4 500',
	accountId: 'otp',
	categoryId: 'food'
};

function codes(form: TransactionForm, ctx = context()) {
	try {
		planTransaction(form, ctx);
	} catch (error) {
		if (error instanceof LedgerError) return error.fields;
		throw error;
	}
	throw new Error('expected a LedgerError');
}

describe('planTransaction', () => {
	it('turns an expense into one negative entry', () => {
		const plan = planTransaction({ ...base, note: '  Spar  ' }, context());
		expect(plan).toEqual({
			kind: 'expense',
			date: '2026-10-18',
			note: 'Spar',
			legs: [
				{
					accountId: 'otp',
					amountMinor: -450000,
					currency: 'HUF',
					categoryId: 'food',
					baseAmountMinor: -450000,
					rate: null
				}
			]
		});
	});

	it('turns income into one positive entry', () => {
		const plan = planTransaction(
			{ ...base, kind: 'income', amount: '350000', categoryId: 'salary' },
			context()
		);
		expect(plan.legs[0]?.amountMinor).toBe(35_000_000);
	});

	it('allows no category', () => {
		expect(planTransaction({ ...base, categoryId: '' }, context()).legs[0]?.categoryId).toBeNull();
	});

	it('converts foreign amounts to the base currency when a rate is known, and leaves it open when not', () => {
		const withRate = planTransaction(
			{ ...base, accountId: 'eur', amount: '10' },
			context('395.12')
		);
		expect(withRate.legs[0]).toMatchObject({
			amountMinor: -1000,
			currency: 'EUR',
			baseAmountMinor: -395120,
			rate: '395.12'
		});
		const without = planTransaction({ ...base, accountId: 'eur', amount: '10' }, context(null));
		expect(without.legs[0]).toMatchObject({ baseAmountMinor: null, rate: null });
	});

	it('makes a same-currency transfer two matching entries', () => {
		const plan = planTransaction(
			{
				kind: 'transfer',
				date: '2026-10-18',
				amount: '20000',
				accountId: 'otp',
				toAccountId: 'cash'
			},
			context()
		);
		expect(plan.legs.map((leg) => [leg.accountId, leg.amountMinor, leg.baseAmountMinor])).toEqual([
			['otp', -2_000_000, -2_000_000],
			['cash', 2_000_000, 2_000_000]
		]);
	});

	it('uses both real amounts for a HUF to EUR exchange, so it nets to zero', () => {
		const plan = planTransaction(
			{
				kind: 'transfer',
				date: '2026-10-18',
				amount: '39 512',
				accountId: 'otp',
				toAccountId: 'eur',
				toAmount: '100'
			},
			context(null)
		);
		expect(plan.legs).toEqual([
			{
				accountId: 'otp',
				amountMinor: -3_951_200,
				currency: 'HUF',
				categoryId: null,
				baseAmountMinor: -3_951_200,
				rate: null
			},
			{
				accountId: 'eur',
				amountMinor: 10_000,
				currency: 'EUR',
				categoryId: null,
				baseAmountMinor: 3_951_200,
				rate: '395.12'
			}
		]);
	});

	it('names every problem by field', () => {
		expect(codes({ kind: 'nope', date: '2026-02-30', amount: 'abc', accountId: 'otp' })).toEqual({
			kind: 'required',
			date: 'invalid_date',
			amount: 'invalid_amount'
		});
		expect(codes({ ...base, amount: '0' })).toEqual({ amount: 'not_positive' });
		expect(codes({ ...base, amount: '' })).toEqual({ amount: 'required' });
		expect(codes({ ...base, accountId: 'missing' })).toEqual({ accountId: 'unknown_account' });
		expect(codes({ ...base, accountId: 'old' })).toEqual({ accountId: 'archived_account' });
		expect(codes({ ...base, categoryId: 'salary' })).toEqual({ categoryId: 'wrong_category' });
		expect(codes({ ...base, kind: 'transfer', toAccountId: 'otp' })).toEqual({
			toAccountId: 'same_account'
		});
		expect(codes({ ...base, kind: 'transfer', toAccountId: 'eur' })).toEqual({
			toAmount: 'to_amount_required'
		});
	});

	it('lets an edit keep an account that was archived since', () => {
		const plan = planTransaction(
			{ ...base, accountId: 'old' },
			{ ...context(), allowArchived: new Set(['old']) }
		);
		expect(plan.legs[0]?.accountId).toBe('old');
	});
});

describe('checkAccount', () => {
	it('cleans a valid account', () => {
		expect(
			checkAccount({
				name: ' OTP ',
				type: 'current',
				currency: 'huf',
				openingBalance: '125 000',
				openingDate: '2026-10-01',
				includeInTotal: true
			})
		).toEqual({
			name: 'OTP',
			type: 'current',
			currency: 'HUF',
			openingBalanceMinor: 12_500_000,
			openingDate: '2026-10-01',
			includeInTotal: true
		});
	});

	it('allows a negative starting balance, e.g. a credit card', () => {
		expect(
			checkAccount({
				name: 'Card',
				type: 'card',
				currency: 'HUF',
				openingBalance: '-20 000',
				openingDate: '2026-10-01',
				includeInTotal: true
			}).openingBalanceMinor
		).toBe(-2_000_000);
	});

	it('rejects missing or unknown values', () => {
		expect(() =>
			checkAccount({
				name: '',
				type: 'vault',
				currency: 'XYZ',
				openingBalance: 'lots',
				openingDate: 'today',
				includeInTotal: true
			})
		).toThrow(LedgerError);
	});
});

describe('isIsoDate', () => {
	it('only accepts real calendar days', () => {
		expect(isIsoDate('2028-02-29')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDate('18/10/2026')).toBe(false);
	});
});
