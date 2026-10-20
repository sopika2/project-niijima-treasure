import { describe, expect, it } from 'vitest';
import { openDatabase } from '../client.ts';
import { accounts, recurringRules, transactionLegs, transactions } from '../schema.ts';
import { trackingStart } from './accounts.ts';
import { averageDailySpend } from './transactions.ts';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

function setup() {
	const treasury = openDatabase({ path: ':memory:', migrationsFolder });
	const { db } = treasury;
	const [otp] = db
		.insert(accounts)
		.values({ name: 'OTP', type: 'current', currency: 'HUF', openingDate: '2026-09-01' })
		.returning()
		.all();
	const spend = (date: string, amount: number, note: string) => {
		const [tx] = db
			.insert(transactions)
			.values({ date, kind: 'expense', status: 'posted', note })
			.returning()
			.all();
		db.insert(transactionLegs)
			.values({
				transactionId: tx!.id,
				accountId: otp!.id,
				amountMinor: -amount,
				currency: 'HUF',
				baseAmountMinor: -amount
			})
			.run();
	};
	return { ...treasury, otp: otp!, spend };
}

describe('trackingStart', () => {
	it('is the earliest opening date, or null without accounts', () => {
		const empty = openDatabase({ path: ':memory:', migrationsFolder });
		expect(trackingStart(empty.db)).toBeNull();
		empty.close();

		const { db, close } = setup();
		db.insert(accounts)
			.values({
				name: 'Old cash',
				type: 'cash',
				currency: 'HUF',
				openingDate: '2026-08-15',
				archived: true
			})
			.run();
		expect(trackingStart(db)).toBe('2026-08-15');
		close();
	});
});

describe('averageDailySpend', () => {
	it('leaves out hand-logged bills that are now recurring items', () => {
		const { db, close, otp, spend } = setup();
		spend('2026-10-01', 180_000_00, 'Rent');
		spend('2026-10-05', 30_000_00, 'Utilities');
		spend('2026-10-08', 4_490_00, 'netflix ');
		spend('2026-10-10', 10_000_00, 'Spar');
		const window = ['2026-10-01', '2026-10-10'] as const;
		expect(averageDailySpend(db, ...window)).toBe(22_449_000 / 10);

		const rule = (name: string, amountMinor: number) =>
			db
				.insert(recurringRules)
				.values({
					name,
					kind: 'expense',
					amountMinor,
					currency: 'HUF',
					accountId: otp.id,
					rrule: 'FREQ=MONTHLY',
					startDate: '2026-11-01'
				})
				.run();
		// Matched by account and amount (rent), and by name (Netflix, whatever the amount).
		rule('Monthly rent', 180_000_00);
		rule('Netflix', 4_990_00);
		expect(averageDailySpend(db, ...window)).toBe(4_000_000 / 10);
		close();
	});
});
