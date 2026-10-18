import { fail } from '@sveltejs/kit';
import { statSync } from 'node:fs';
import { currentRates, foreignCurrencies } from '@treasure/db';
import { text } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = await runtime();
	const style = app.style.current();
	const drive = await app.snapshots.drive();
	const databaseBytes = statSync(app.paths.database, { throwIfNoEntry: false })?.size ?? 0;

	return {
		version: app.version,
		startedAt: app.startedAt.toISOString(),
		snapshot: app.snapshots.status(),
		drive: { ...drive, path: app.paths.drive },
		nightly: app.config.snapshots.nightly_at,
		database: {
			path: app.paths.database,
			bytes: databaseBytes,
			instance: app.treasury.instanceId.slice(0, 8)
		},
		style: {
			name: style.style.meta.name,
			source: style.source,
			defaultsUsed: style.defaultsUsed.length
		},
		config: {
			path: app.paths.config,
			baseCurrency: app.config.base_currency,
			timezone: app.config.timezone,
			locale: app.config.locale,
			extensions: app.extensions.map((extension) => extension.manifest.name)
		},
		access: app.access.mode,
		rates: {
			status: app.rates.status(),
			enabled: app.config.rates.enabled,
			base: app.config.base_currency,
			rows: currentRates(
				app.treasury.db,
				foreignCurrencies(app.treasury.db, app.config.base_currency),
				app.config.base_currency
			).map((row) => ({
				currency: row.currency,
				value: row.value?.rate ?? null,
				buy: row.buy?.rate ?? null,
				sell: row.sell?.rate ?? null,
				source: row.value?.source ?? null,
				validFrom: row.value?.validFrom ?? null
			}))
		}
	};
};

const RATE = /^\d{1,7}([.,]\d{1,8})?$/;

export const actions: Actions = {
	refreshRates: async () => {
		const app = await runtime();
		await app.rates.refresh();
		const problem = app.rates.status().problem;
		return problem ? fail(502, { rates: problem }) : { refreshed: true };
	},

	manualRate: async ({ request }) => {
		const app = await runtime();
		const form = await request.formData();
		const currency = text(form, 'currency');
		const rate = text(form, 'rate').trim();
		if (!foreignCurrencies(app.treasury.db, app.config.base_currency).includes(currency)) {
			return fail(400, { errors: { currency: 'unknown_currency' } });
		}
		if (!RATE.test(rate) || Number(rate.replace(',', '.')) <= 0) {
			return fail(400, { errors: { rate: 'invalid_rate' } });
		}
		app.rates.addManual(currency, rate.replace(',', '.'));
		return { manual: true };
	},

	snapshot: async () => {
		const app = await runtime();
		try {
			await app.snapshots.now();
			return { saved: true };
		} catch (error) {
			return fail(503, {
				saved: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
};
