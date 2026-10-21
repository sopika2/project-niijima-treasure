import { addDays } from '@treasure/core';
import type { Scope } from '@treasure/db';
import { monthRange, today } from './ledger.ts';
import { budgetRows, goalRows } from './plans.ts';
import { projection } from './projection.ts';
import { upcomingEvents } from './recurring.ts';
import type { Runtime } from './runtime.ts';
import { statsReader } from './stats.ts';
import { verdicts } from './verdicts.ts';

/**
 * What the Niijima Network homepage shows. Read-only, numbers only, in minor units of the base
 * currency (divide by 100 for forints). With a scope, only that sister's money and the shared.
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

export async function buildSummary(runtime: Runtime, scope?: Scope): Promise<Summary> {
	const stats = statsReader(runtime, scope);
	const { day, month } = today(runtime);
	const monthEnd = monthRange(month).to;
	const [system, accounts, ahead, alerts] = await Promise.all([
		stats.system(),
		stats.accounts(),
		projection(runtime, daysBetween(day, monthEnd), [], scope),
		verdicts(runtime, scope)
	]);
	const end = ahead.points.find((point) => point.date === monthEnd) ?? ahead.end;
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
		projected: {
			end_of_month: end.balanceMinor,
			lowest_this_month: ahead.lowest.balanceMinor
		},
		next_bills: upcomingEvents(runtime, addDays(day, 14), scope)
			.filter((event) => event.amountMinor < 0)
			.slice(0, 5)
			.map((event) => ({ name: event.label, date: event.date, amount: -event.amountMinor })),
		budgets_over_warn: budgetRows(runtime, month, scope)
			.filter((row) => row.state === 'over' || row.state === 'warn')
			.map((row) => ({ category: row.name, percent: Math.round(row.used * 100) })),
		treasures: goalRows(runtime, { scope })
			.filter((goal) => !goal.reached)
			.map((goal) => ({ name: goal.name, percent: Math.round(goal.progress * 100) })),
		verdicts: alerts.filter((verdict) => verdict.tone !== 'info').length,
		backup: { state: system.snapshot.state, last_saved_at: system.snapshot.lastSavedAt },
		rates_as_of: system.ratesAsOf
	};
}

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
