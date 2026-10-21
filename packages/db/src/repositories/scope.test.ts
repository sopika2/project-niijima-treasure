import { describe, expect, it } from 'vitest';
import { openDatabase } from '../client.ts';
import { accounts, categories, transactionLegs, transactions, type Owner } from '../schema.ts';
import { scopeFor } from '../scope.ts';
import { accountBalances, trackingStart } from './accounts.ts';
import { listAccounts } from './catalog.ts';
import { budgetsForMonth, listGoals, createGoal, setBudget } from './plans.ts';
import { listTransactions, periodTotals, spendingByCategory } from './transactions.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

function setup() {
	const treasury = openDatabase({ path: ':memory:', migrationsFolder });
	const { db } = treasury;
	const account = (name: string, owner: Owner, openingDate = '2026-10-01') =>
		db
			.insert(accounts)
			.values({ name, type: 'current', currency: 'HUF', openingDate, owner })
			.returning()
			.get()!;
	const makoto = account('Makoto OTP', 'makoto');
	const sae = account('Sae OTP', 'sae', '2026-09-01');
	const shared = account('Household', 'shared');
	const [food] = db.insert(categories).values({ name: 'Food', kind: 'expense' }).returning().all();
	const post = (kind: 'expense' | 'income' | 'transfer', legs: Array<[string, number]>) => {
		const tx = db
			.insert(transactions)
			.values({ date: '2026-10-10', kind, status: 'posted' })
			.returning()
			.get()!;
		for (const [accountId, amount] of legs) {
			db.insert(transactionLegs)
				.values({
					transactionId: tx.id,
					accountId,
					amountMinor: amount,
					currency: 'HUF',
					baseAmountMinor: amount,
					categoryId: kind === 'expense' ? food!.id : null
				})
				.run();
		}
	};
	post('expense', [[makoto.id, -1_000_00]]);
	post('expense', [[sae.id, -3_000_00]]);
	post('expense', [[shared.id, -500_00]]);
	post('transfer', [
		[sae.id, -10_000_00],
		[makoto.id, 10_000_00]
	]);
	return { ...treasury, makoto, sae, shared, food: food! };
}

describe('personas', () => {
	it('each persona sees her own accounts and the shared ones', () => {
		const { db, close } = setup();
		const names = (persona: 'makoto' | 'sae') =>
			listAccounts(db, { scope: scopeFor(persona) })
				.map((a) => a.name)
				.sort();
		expect(names('makoto')).toEqual(['Household', 'Makoto OTP']);
		expect(names('sae')).toEqual(['Household', 'Sae OTP']);
		expect(listAccounts(db)).toHaveLength(3);
		expect(trackingStart(db, scopeFor('makoto'))).toBe('2026-10-01');
		expect(trackingStart(db, scopeFor('sae'))).toBe('2026-09-01');
		close();
	});

	it('balances, spending and transactions follow the accounts', () => {
		const { db, close } = setup();
		const balances = (persona: 'makoto' | 'sae') =>
			Object.fromEntries(
				accountBalances(db, { scope: scopeFor(persona) }).map((b) => [
					b.account.name,
					b.balanceMinor
				])
			);
		// Sae paid Makoto 10,000: it shows on both sides.
		expect(balances('makoto')).toEqual({ 'Makoto OTP': 9_000_00, Household: -500_00 });
		expect(balances('sae')).toEqual({ 'Sae OTP': -13_000_00, Household: -500_00 });
		expect(periodTotals(db, '2026-10-01', '2026-10-31', scopeFor('makoto')).expenseMinor).toBe(
			1_500_00
		);
		expect(periodTotals(db, '2026-10-01', '2026-10-31', scopeFor('sae')).expenseMinor).toBe(
			3_500_00
		);
		expect(periodTotals(db, '2026-10-01', '2026-10-31').expenseMinor).toBe(4_500_00);
		expect(
			spendingByCategory(db, '2026-10-01', '2026-10-31', scopeFor('sae'))[0]?.amountMinor
		).toBe(3_500_00);
		expect(listTransactions(db, { scope: scopeFor('makoto') })).toHaveLength(3);
		expect(listTransactions(db, { scope: scopeFor('sae') })).toHaveLength(3);
		expect(listTransactions(db)).toHaveLength(4);
		close();
	});

	it('budgets and treasures belong to a persona', () => {
		const { db, close, food } = setup();
		setBudget(db, { categoryId: food.id, limitMinor: 50_000_00, currency: 'HUF', owner: 'makoto' });
		setBudget(db, { categoryId: food.id, limitMinor: 80_000_00, currency: 'HUF', owner: 'sae' });
		const limit = (persona: 'makoto' | 'sae') =>
			budgetsForMonth(db, '2026-10', scopeFor(persona)).map((b) => b.limitMinor);
		expect(limit('makoto')).toEqual([50_000_00]);
		expect(limit('sae')).toEqual([80_000_00]);

		createGoal(db, {
			name: 'Bike',
			targetMinor: 1,
			currency: 'HUF',
			deadline: null,
			accountId: null,
			owner: 'makoto'
		});
		createGoal(db, {
			name: 'Trip',
			targetMinor: 1,
			currency: 'HUF',
			deadline: null,
			accountId: null
		});
		expect(listGoals(db, { scope: scopeFor('makoto') }).map((g) => g.name)).toEqual([
			'Bike',
			'Trip'
		]);
		expect(listGoals(db, { scope: scopeFor('sae') }).map((g) => g.name)).toEqual(['Trip']);
		close();
	});
});
