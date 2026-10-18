import { describe, expect, it } from 'vitest';
import { openDatabase } from '../client.ts';
import { accounts, transactionLegs, transactions } from '../schema.ts';
import { accountBalances } from './accounts.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

describe('accountBalances', () => {
	it('adds posted legs to the opening balance and ignores pending, deleted and archived', () => {
		const { db, close } = openDatabase({ path: ':memory:', migrationsFolder });
		const [otp] = db
			.insert(accounts)
			.values({
				name: 'OTP HUF',
				type: 'current',
				currency: 'HUF',
				openingBalanceMinor: 10_000_00,
				openingDate: '2026-10-01'
			})
			.returning()
			.all();
		db.insert(accounts)
			.values({
				name: 'Old',
				type: 'cash',
				currency: 'HUF',
				openingDate: '2026-01-01',
				archived: true
			})
			.run();
		db.insert(accounts)
			.values({
				name: 'Cash',
				type: 'cash',
				currency: 'HUF',
				openingDate: '2026-10-01',
				sortOrder: 1
			})
			.run();

		const leg = (status: 'posted' | 'pending', amount: number, deleted = false) => {
			const [tx] = db
				.insert(transactions)
				.values({
					date: '2026-10-10',
					kind: 'expense',
					status,
					deletedAt: deleted ? '2026-10-11' : null
				})
				.returning()
				.all();
			db.insert(transactionLegs)
				.values({
					transactionId: tx!.id,
					accountId: otp!.id,
					amountMinor: amount,
					currency: 'HUF',
					baseAmountMinor: amount
				})
				.run();
		};
		leg('posted', -2_500_00);
		leg('posted', -500_00);
		leg('pending', -9_999_00);
		leg('posted', -1_000_00, true);

		const balances = accountBalances(db);
		expect(balances.map((row) => [row.account.name, row.balanceMinor])).toEqual([
			['OTP HUF', 7_000_00],
			['Cash', 0]
		]);
		close();
	});
});
