import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.ts';
import { accounts, transactionLegs, transactions, type Account } from '../schema.ts';

export interface AccountBalance {
	readonly account: Account;
	/** Opening balance plus every posted, non-deleted leg, in the account's own currency. */
	readonly balanceMinor: number;
}

/** Current balance of every account that is not archived, in display order. */
export function accountBalances(db: Db): AccountBalance[] {
	const posted = db
		.select({
			accountId: transactionLegs.accountId,
			total: sql<number>`coalesce(sum(${transactionLegs.amountMinor}), 0)`.as('total')
		})
		.from(transactionLegs)
		.innerJoin(transactions, eq(transactions.id, transactionLegs.transactionId))
		.where(and(eq(transactions.status, 'posted'), isNull(transactions.deletedAt)))
		.groupBy(transactionLegs.accountId)
		.as('posted');

	return db
		.select({ account: accounts, moved: sql<number>`coalesce(${posted.total}, 0)` })
		.from(accounts)
		.leftJoin(posted, eq(posted.accountId, accounts.id))
		.where(eq(accounts.archived, false))
		.orderBy(asc(accounts.sortOrder), asc(accounts.name))
		.all()
		.map(({ account, moved }) => ({
			account,
			balanceMinor: account.openingBalanceMinor + Number(moved)
		}));
}
