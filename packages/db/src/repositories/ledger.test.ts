import { planTransaction, type LedgerContext } from '@treasure/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Treasury } from '../client.ts';
import { accountBalances } from './accounts.ts';
import {
	AccountLockedError,
	categoryUsage,
	createAccount,
	createCategory,
	DuplicateNameError,
	listCategories,
	renameCategory,
	seedCategories,
	updateAccount
} from './catalog.ts';
import {
	createTransaction,
	deleteTransaction,
	getTransaction,
	listTransactions,
	periodTotals,
	spendingByCategory,
	updateTransaction
} from './transactions.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;
let treasury: Treasury;

beforeEach(() => {
	treasury = openDatabase({ path: ':memory:', migrationsFolder });
});
afterEach(() => treasury.close());

function setup() {
	const { db } = treasury;
	seedCategories(db);
	const otp = createAccount(db, {
		name: 'OTP',
		type: 'current',
		currency: 'HUF',
		openingBalanceMinor: 100_000_00,
		openingDate: '2026-10-01',
		includeInTotal: true
	});
	const cash = createAccount(db, {
		name: 'Cash',
		type: 'cash',
		currency: 'HUF',
		openingBalanceMinor: 0,
		openingDate: '2026-10-01',
		includeInTotal: true
	});
	const categories = listCategories(db);
	const groceries = categories.find((category) => category.name === 'Groceries')!;
	const salary = categories.find((category) => category.name === 'Salary')!;
	const context: LedgerContext = {
		accounts: new Map([otp, cash].map((account) => [account.id, account])),
		categories: new Map(categories.map((category) => [category.id, category])),
		baseCurrency: 'HUF',
		rateFor: () => null
	};
	const add = (form: Parameters<typeof planTransaction>[0]) =>
		createTransaction(db, planTransaction(form, context));
	return { db, otp, cash, groceries, salary, context, add };
}

describe('ledger storage', () => {
	it('seeds the default categories once', () => {
		expect(seedCategories(treasury.db)).toBeGreaterThan(10);
		expect(seedCategories(treasury.db)).toBe(0);
	});

	it('keeps balances, month totals and spending in step', () => {
		const { db, otp, cash, groceries, salary, add } = setup();
		add({
			kind: 'expense',
			date: '2026-10-05',
			amount: '4500',
			accountId: otp.id,
			categoryId: groceries.id,
			note: 'Spar'
		});
		add({
			kind: 'income',
			date: '2026-10-10',
			amount: '350000',
			accountId: otp.id,
			categoryId: salary.id
		});
		add({
			kind: 'transfer',
			date: '2026-10-12',
			amount: '20000',
			accountId: otp.id,
			toAccountId: cash.id
		});
		add({
			kind: 'expense',
			date: '2026-11-02',
			amount: '1000',
			accountId: cash.id,
			categoryId: groceries.id
		});

		const today = accountBalances(db, { asOf: '2026-10-31' });
		expect(today.map((row) => [row.account.name, row.balanceMinor])).toEqual([
			['OTP', (100_000 - 4_500 + 350_000 - 20_000) * 100],
			['Cash', 20_000 * 100]
		]);

		expect(periodTotals(db, '2026-10-01', '2026-10-31')).toEqual({
			incomeMinor: 350_000_00,
			expenseMinor: 4_500_00,
			missingRates: 0
		});
		expect(spendingByCategory(db, '2026-10-01', '2026-10-31')).toEqual([
			{ categoryId: groceries.id, amountMinor: 4_500_00, count: 1 }
		]);
		expect(categoryUsage(db).get(groceries.id)).toBe(2);
	});

	it('lists newest first and filters by account, category, kind and note', () => {
		const { db, otp, cash, groceries, add } = setup();
		add({
			kind: 'expense',
			date: '2026-10-05',
			amount: '4500',
			accountId: otp.id,
			categoryId: groceries.id,
			note: 'Spar 100%'
		});
		add({
			kind: 'transfer',
			date: '2026-10-12',
			amount: '20000',
			accountId: otp.id,
			toAccountId: cash.id
		});

		const october = { from: '2026-10-01', to: '2026-10-31' };
		expect(listTransactions(db, october).map((row) => row.kind)).toEqual(['transfer', 'expense']);
		expect(listTransactions(db, { ...october, accountId: cash.id })).toHaveLength(1);
		expect(listTransactions(db, { ...october, categoryId: groceries.id })).toHaveLength(1);
		expect(listTransactions(db, { ...october, kind: 'expense' })).toHaveLength(1);
		expect(listTransactions(db, { ...october, search: 'spar' })).toHaveLength(1);
		expect(listTransactions(db, { ...october, search: '100%' })).toHaveLength(1);
		expect(listTransactions(db, { ...october, search: '_' })).toHaveLength(0);

		const transfer = listTransactions(db, { ...october, kind: 'transfer' })[0]!;
		expect(transfer.legs.map((leg) => leg.accountId)).toEqual([otp.id, cash.id]);
	});

	it('edits replace the entries, and deletes hide the transaction everywhere', () => {
		const { db, otp, groceries, context, add } = setup();
		const id = add({
			kind: 'expense',
			date: '2026-10-05',
			amount: '4500',
			accountId: otp.id,
			categoryId: groceries.id
		});
		updateTransaction(
			db,
			id,
			planTransaction(
				{
					kind: 'expense',
					date: '2026-10-06',
					amount: '5000',
					accountId: otp.id,
					categoryId: groceries.id
				},
				context
			)
		);
		expect(getTransaction(db, id)?.legs.map((leg) => leg.amountMinor)).toEqual([-5_000_00]);

		expect(deleteTransaction(db, id)).toBe(true);
		expect(getTransaction(db, id)).toBeUndefined();
		expect(listTransactions(db)).toEqual([]);
		expect(periodTotals(db, '2026-10-01', '2026-10-31').expenseMinor).toBe(0);
		expect(deleteTransaction(db, id)).toBe(false);
	});

	it('locks an account currency once it has transactions', () => {
		const { db, otp, groceries, add } = setup();
		const change = { ...otp, currency: 'EUR' };
		add({
			kind: 'expense',
			date: '2026-10-05',
			amount: '1',
			accountId: otp.id,
			categoryId: groceries.id
		});
		expect(() => updateAccount(db, otp.id, change)).toThrow(AccountLockedError);
		expect(updateAccount(db, otp.id, { ...otp, name: 'OTP main' })?.name).toBe('OTP main');
	});

	it('refuses duplicate category names of the same kind', () => {
		const { db } = setup();
		expect(() => createCategory(db, { name: 'groceries', kind: 'expense' })).toThrow(
			DuplicateNameError
		);
		const books = createCategory(db, { name: 'Books', kind: 'expense' });
		expect(() => renameCategory(db, books.id, 'Groceries')).toThrow(DuplicateNameError);
		expect(createCategory(db, { name: 'Groceries', kind: 'income' }).kind).toBe('income');
	});
});
