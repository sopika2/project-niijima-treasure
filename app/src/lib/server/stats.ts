import { convert, money } from '@treasure/core';
import { accountBalances, latestMiddleRate, ratesFreshness } from '@treasure/db';
import type { AccountsData, AccountSummary, StatsReader } from '@treasure/stats-sdk';
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
			const accounts: AccountSummary[] = accountBalances(db).map(({ account, balanceMinor }) => {
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
			});
			return { accounts, total: money(total, base), missingRates: [...missing].sort() };
		}
	};
}
