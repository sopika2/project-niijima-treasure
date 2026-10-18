import { defineQuery, type CategoryAmount, type MoneyValue } from '@treasure/stats-sdk';

export interface SpendingRow {
	readonly name: string | null;
	readonly color: number | null;
	readonly amount: MoneyValue;
	readonly share: number;
}

export interface SpendingWidgetData {
	readonly month: string;
	readonly total: MoneyValue;
	readonly rows: readonly SpendingRow[];
	/** Size of the biggest row, so bars share one scale. */
	readonly max: number;
	readonly missingRates: number;
}

export interface SpendingSettings {
	readonly top: number;
}

/** Biggest categories first; the long tail folds into one "Other" row so colors never repeat. */
export default defineQuery<SpendingWidgetData, SpendingSettings>(async ({ stats, settings }) => {
	const spending = await stats.spending();
	const shown: CategoryAmount[] = spending.categories.slice(0, settings.top);
	const rest = spending.categories.slice(settings.top);
	const rows: SpendingRow[] = shown.map((row) => ({
		name: row.name || null,
		color: row.id ? row.color : null,
		amount: row.amount,
		share: row.share
	}));
	if (rest.length > 0) {
		rows.push({
			name: null,
			color: null,
			amount: {
				amount: rest.reduce((sum, row) => sum + row.amount.amount, 0),
				currency: spending.total.currency
			},
			share: rest.reduce((sum, row) => sum + row.share, 0)
		});
	}
	return {
		month: spending.month,
		total: spending.total,
		rows,
		max: Math.max(0, ...rows.map((row) => row.amount.amount)),
		missingRates: spending.missingRates
	};
});
