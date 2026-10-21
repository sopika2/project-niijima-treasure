import { frequentNotes, listAccounts, listCategories } from '@treasure/db';
import { accountOption, categoryOption, scopeOf, today } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import { statsReader } from '#lib/server/stats.ts';
import type { LayoutServerLoad } from './$types';

/** What every signed-in page needs: the banner problems and what the Add sheet offers. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const app = await runtime();
	const { db } = app.treasury;
	const scope = scopeOf(locals);
	const { total } = await statsReader(app, scope).accounts();
	return {
		persona: locals.persona,
		wallet: total,
		problems: app.problems(),
		accounts: listAccounts(db, { scope }).map(accountOption),
		categories: listCategories(db).map(categoryOption),
		notes: frequentNotes(db),
		today: today(app).day,
		signedIn: app.access.mode === 'discord'
	};
};
