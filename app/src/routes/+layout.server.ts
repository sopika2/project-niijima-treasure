import { runtime } from '#lib/server/runtime.ts';
import type { LayoutServerLoad } from './$types';

/** What every page needs, signed in or not: the words and look from style.yml. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const app = await runtime();
	const { style, hash } = app.style.current();
	return {
		ui: {
			copy: style.copy,
			layout: style.layout,
			charts: style.charts,
			locale: app.config.locale,
			baseCurrency: app.config.base_currency
		},
		styleHash: hash,
		favicon: style.assets.favicon,
		logo: style.assets.logo,
		menuArt: style.assets.menu_art,
		user: locals.user
	};
};
