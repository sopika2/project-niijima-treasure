import { restrictReader } from '@treasure/stats-sdk';
import { orderForDashboard } from '#lib/server/extensions.ts';
import { logError } from '#lib/server/log.ts';
import { runtime } from '#lib/server/runtime.ts';
import { localDay } from '#lib/server/snapshots.ts';
import { statsReader } from '#lib/server/stats.ts';
import type { PageServerLoad } from './$types';

interface WidgetData {
	readonly id: string;
	readonly name: string;
	readonly wide: boolean;
	readonly settings: Record<string, unknown>;
	readonly data: unknown;
	readonly error: string | null;
}

export const load: PageServerLoad = async () => {
	const app = await runtime();
	const reader = statsReader(app);
	const order = app.style.current().style.layout.dashboard_order;
	const { day } = localDay(app.config.timezone);

	const widgets = await Promise.all(
		orderForDashboard(app.extensions, order).map(async (extension): Promise<WidgetData> => {
			const { manifest, query, settings } = extension;
			const base = {
				id: manifest.id,
				name: manifest.name,
				wide: manifest.size === 'wide',
				settings
			};
			try {
				const data = query
					? await query({
							stats: restrictReader(reader, manifest.id, manifest.reads),
							settings,
							baseCurrency: app.config.base_currency,
							locale: app.config.locale,
							today: day
						})
					: null;
				return { ...base, data, error: null };
			} catch (error) {
				logError(`extension ${manifest.id}`, error);
				return {
					...base,
					data: null,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		})
	);

	const { accounts } = await reader.accounts();
	return { widgets, hasAccounts: accounts.length > 0 };
};
