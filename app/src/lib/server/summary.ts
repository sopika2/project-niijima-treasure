import type { Runtime } from './runtime.ts';
import { statsReader } from './stats.ts';

/**
 * What the Niijima Network homepage shows. Read-only, numbers only, in minor units of the base
 * currency (divide by 100 for forints). Fields fill in as later milestones land: `projected`
 * with the projection engine, `next_bills` with recurring items, `budgets_over_warn` with budgets
 * and `treasures` with savings goals.
 */
export interface Summary {
	readonly as_of: string;
	readonly app_version: string;
	readonly base_currency: string;
	readonly minor_units: 100;
	readonly total: number;
	readonly accounts: ReadonlyArray<{
		readonly name: string;
		readonly balance: number;
		readonly currency: string;
	}>;
	readonly missing_rates: readonly string[];
	readonly projected: { readonly end_of_month: number; readonly lowest_this_month: number } | null;
	readonly next_bills: ReadonlyArray<{
		readonly name: string;
		readonly date: string;
		readonly amount: number;
	}>;
	readonly budgets_over_warn: ReadonlyArray<{
		readonly category: string;
		readonly percent: number;
	}>;
	readonly treasures: ReadonlyArray<{ readonly name: string; readonly percent: number }>;
	readonly verdicts: number;
	readonly backup: { readonly state: string; readonly last_saved_at: string | null };
	readonly rates_as_of: string | null;
}

export async function buildSummary(runtime: Runtime): Promise<Summary> {
	const stats = statsReader(runtime);
	const [system, accounts] = await Promise.all([stats.system(), stats.accounts()]);
	return {
		as_of: new Date().toISOString(),
		app_version: runtime.version,
		base_currency: runtime.config.base_currency,
		minor_units: 100,
		total: accounts.total.amount,
		accounts: accounts.accounts.map((account) => ({
			name: account.name,
			balance: account.balance.amount,
			currency: account.balance.currency
		})),
		missing_rates: accounts.missingRates,
		projected: null,
		next_bills: [],
		budgets_over_warn: [],
		treasures: [],
		verdicts: runtime.problems().filter((problem) => problem.tone !== 'info').length,
		backup: { state: system.snapshot.state, last_saved_at: system.snapshot.lastSavedAt },
		rates_as_of: system.ratesAsOf
	};
}
