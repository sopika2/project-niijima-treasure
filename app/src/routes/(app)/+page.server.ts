import { restrictReader } from '@treasure/stats-sdk';
import { orderForDashboard } from '#lib/server/extensions.ts';
import { logError } from '#lib/server/log.ts';
import { runtime } from '#lib/server/runtime.ts';
import { localDay } from '#lib/server/snapshots.ts';
import { statsReader } from '#lib/server/stats.ts';
import { listTransactions, periodTotals } from '@treasure/db';
import { addDays } from '@treasure/core';
import { lookup, monthRange, scopeOf, transactionRow } from '#lib/server/ledger.ts';
import { projection } from '#lib/server/projection.ts';
import { upcomingEvents } from '#lib/server/recurring.ts';
import { verdicts } from '#lib/server/verdicts.ts';
import type { PageServerLoad } from './$types';

interface WidgetData {
	readonly id: string;
	readonly name: string;
	readonly wide: boolean;
	readonly settings: Record<string, unknown>;
	readonly data: unknown;
	readonly error: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const app = await runtime();
	const scope = scopeOf(locals);
	const reader = statsReader(app, scope);
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
	const ahead = await projection(app, undefined, [], scope);
	const monthEnd = ahead.points.find((point) => point.date === to) ?? ahead.points.at(-1);
	return {
		widgets,
		balances,
		month: periodTotals(app.treasury.db, from, to, scope),
		recent: listTransactions(app.treasury.db, { limit: 8, status: 'posted', scope }).map((row) =>
			transactionRow(row, accounts, categories)
		),
		verdicts: await verdicts(app, scope),
		forecast: {
			points: ahead.points.map((point) => ({ date: point.date, value: point.balanceMinor })),
			lowest: { date: ahead.lowest.date, value: ahead.lowest.balanceMinor },
			monthEnd: monthEnd ? { date: monthEnd.date, value: monthEnd.balanceMinor } : null,
			end: { date: ahead.end.date, value: ahead.end.balanceMinor },
			dailySpend: ahead.dailySpendMinor,
			basis: ahead.basis,
			months: ahead.months,
			days: ahead.days,
			floor: app.config.alerts.balance_floor * 100
		},
		upcoming: upcomingEvents(app, addDays(day, 21), scope).slice(0, 8)
	};
};
