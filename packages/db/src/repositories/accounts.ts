import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { accounts, transactionLegs, transactions, type Account } from '../schema.ts';
import { ownedBy, type Scope } from '../scope.ts';

export interface AccountBalance {
	readonly account: Account;
	/**
	 * Opening balance plus every posted, non-deleted leg from the opening date on, in the
	 * account's own currency. Legs dated before the opening date are already part of the
	 * opening balance, so they still count as income or spending but don't move the balance.
	 */
	readonly balanceMinor: number;
}

/**
 * The day tracking began: the earliest starting-balance date of any account, archived ones
 * included. Averages and charts start here, so months before you began don't count as zero.
 * Null when there are no accounts yet.
 */
export function trackingStart(db: Db, scope?: Scope | null): string | null {
	const row = db
		.select({ day: sql<string | null>`min(${accounts.openingDate})` })
		.from(accounts)
		.where(ownedBy(accounts.owner, scope))
		.get();
	return row?.day ?? null;
}

/**
 * Balance of every account that is not archived, in display order. With `asOf` (YYYY-MM-DD),
 * entries dated later are left out, so a future-dated bill doesn't change today's balance,
 * and an account whose opening date is after `asOf` has no balance yet (0).
 */
export function accountBalances(
	db: Db,
	options: { asOf?: string; includeArchived?: boolean; scope?: Scope | null } = {}
): AccountBalance[] {
	const posted = db
		.select({
			accountId: transactionLegs.accountId,
			total: sql<number>`coalesce(sum(${transactionLegs.amountMinor}), 0)`.as('total')
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionLegs.accountId))
		.where(
			and(
				eq(transactions.status, 'posted'),
				isNull(transactions.deletedAt),
				gte(transactions.date, accounts.openingDate),
				options.asOf ? lte(transactions.date, options.asOf) : undefined
			)
		)
		.groupBy(transactionLegs.accountId)
		.as('posted');

	return db
		.select({ account: accounts, moved: sql<number>`coalesce(${posted.total}, 0)` })
		.from(accounts)
		.leftJoin(posted, eq(posted.accountId, accounts.id))
		.where(
			and(
				options.includeArchived ? undefined : eq(accounts.archived, false),
				ownedBy(accounts.owner, options.scope)
			)
		)
		.orderBy(asc(accounts.archived), asc(accounts.sortOrder), asc(accounts.name))
		.all()
		.map(({ account, moved }) => ({
			account,
			// Nothing is known about an account before its starting balance.
			balanceMinor:
				options.asOf && account.openingDate > options.asOf
					? 0
					: account.openingBalanceMinor + Number(moved)
		}));
}
