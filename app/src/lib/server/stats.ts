import { convert, money } from '@treasure/core';
import {
	accountBalances,
	latestMiddleRate,
	listCategories,
	periodTotals,
	ratesFreshness,
	spendingByCategory
} from '@treasure/db';
import type { AccountsData, AccountSummary, SpendingData, StatsReader } from '@treasure/stats-sdk';
import { categoryOption, isMonth, monthRange, today } from './ledger.ts';
import type { Runtime } from './runtime.ts';

/** The full read-only data API. Extensions only ever get a restricted copy of it. */
export function statsReader(runtime: Runtime): StatsReader {
	const { db } = runtime.treasury;
	const base = runtime.config.base_currency;

	return {
		async system() {
			const snapshot = runtime.snapshots.status();
			const drive = await runtime.snapshots.drive();
			return {
				appVersion: runtime.version,
				baseCurrency: base,
				locale: runtime.config.locale,
				timezone: runtime.config.timezone,
				snapshot: {
					state: snapshot.state,
					lastSavedAt: snapshot.lastSavedAt,
					problem: snapshot.problem
				},
				drive: { reachable: drive.reachable && drive.writable },
				ratesAsOf: ratesFreshness(db)
			};
		},

		async accounts(): Promise<AccountsData> {
			const missing = new Set<string>();
			let total = 0;
			const asOf = today(runtime).day;
			const accounts: AccountSummary[] = accountBalances(db, { asOf }).map(
				({ account, balanceMinor }) => {
					const balance = money(balanceMinor, account.currency);
					let baseBalance: { amount: number; currency: string } | null = balance;
					if (account.currency !== base) {
						const rate = latestMiddleRate(db, account.currency, base);
						baseBalance = rate
							? convert(balance, { from: account.currency, to: base, rate: rate.rate })
							: null;
					}
					if (account.includeInTotal) {
						if (baseBalance) total += baseBalance.amount;
						else missing.add(account.currency);
					}
					return {
						id: account.id,
						name: account.name,
						type: account.type,
						balance,
						baseBalance,
						includeInTotal: account.includeInTotal
					};
				}
			);
			return { accounts, total: money(total, base), missingRates: [...missing].sort() };
		},

		async spending(month?: string): Promise<SpendingData> {
			const chosen = isMonth(month) ? month : today(runtime).month;
			const { from, to } = monthRange(chosen);
			const totals = periodTotals(db, from, to);
			const names = new Map(
				listCategories(db, { includeArchived: true }).map((row) => [row.id, row])
			);
			const rows = spendingByCategory(db, from, to);
			return {
				month: chosen,
				total: money(totals.expenseMinor, base),
				missingRates: totals.missingRates,
				categories: rows.map((row) => {
					const category = row.categoryId ? names.get(row.categoryId) : undefined;
					return {
						id: row.categoryId,
						name: category?.name ?? '',
						color: category ? categoryOption(category).color : 8,
						amount: money(row.amountMinor, base),
						share: totals.expenseMinor > 0 ? row.amountMinor / totals.expenseMinor : 0,
						count: row.count
					};
				})
			};
		}
	};
}
