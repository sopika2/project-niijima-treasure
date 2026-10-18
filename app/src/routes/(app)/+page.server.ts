import { restrictReader } from '@treasure/stats-sdk';
import { orderForDashboard } from '#lib/server/extensions.ts';
import { logError } from '#lib/server/log.ts';
import { runtime } from '#lib/server/runtime.ts';
import { localDay } from '#lib/server/snapshots.ts';
import { statsReader } from '#lib/server/stats.ts';
import { listTransactions, periodTotals } from '@treasure/db';
import { lookup, monthRange, transactionRow } from '#lib/server/ledger.ts';
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

	const balances = await reader.accounts();
	const { accounts, categories } = lookup(app);
	const month = day.slice(0, 7);
	const { from, to } = monthRange(month);
	return {
		widgets,
		balances,
		month: periodTotals(app.treasury.db, from, to),
		recent: listTransactions(app.treasury.db, { limit: 8 }).map((row) =>
			transactionRow(row, accounts, categories)
		)
	};
};
