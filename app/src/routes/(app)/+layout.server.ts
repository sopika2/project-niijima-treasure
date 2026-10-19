import { frequentNotes, listAccounts, listCategories } from '@treasure/db';
import { accountOption, categoryOption, today } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import { statsReader } from '#lib/server/stats.ts';
import type { LayoutServerLoad } from './$types';

/** What every signed-in page needs: the banner problems and what the Add sheet offers. */
export const load: LayoutServerLoad = async () => {
	const app = await runtime();
	const { db } = app.treasury;
	const { total, accounts: balances } = await statsReader(app).accounts();
	return {
		wallet: total,
		// The command menu's "party": accounts in the total, biggest first, with their share.
		party: balances
			.filter((account) => account.includeInTotal && account.baseBalance)
			.sort((a, b) => (b.baseBalance?.amount ?? 0) - (a.baseBalance?.amount ?? 0))
			.slice(0, 4)
			.map((account) => ({
				name: account.name,
				share: total.amount > 0 ? Math.max(0, (account.baseBalance?.amount ?? 0) / total.amount) : 0
			})),
		problems: app.problems(),
		accounts: listAccounts(db).map(accountOption),
		categories: listCategories(db).map(categoryOption),
		notes: frequentNotes(db),
		today: today(app).day,
		signedIn: app.access.mode === 'discord'
	};
};
