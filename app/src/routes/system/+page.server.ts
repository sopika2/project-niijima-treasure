import { fail } from '@sveltejs/kit';
import { statSync } from 'node:fs';
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
		access: app.access.mode
	};
};

export const actions: Actions = {
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
