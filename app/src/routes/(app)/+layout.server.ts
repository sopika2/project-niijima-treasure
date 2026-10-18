import { frequentNotes, listAccounts, listCategories } from '@treasure/db';
import { accountOption, categoryOption, today } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { LayoutServerLoad } from './$types';

/** What every signed-in page needs: the banner problems and what the Add sheet offers. */
export const load: LayoutServerLoad = async () => {
	const app = await runtime();
	const { db } = app.treasury;
	return {
		problems: app.problems(),
		accounts: listAccounts(db).map(accountOption),
		categories: listCategories(db).map(categoryOption),
		notes: frequentNotes(db),
		today: today(app).day,
		signedIn: app.access.mode === 'discord'
	};
};
