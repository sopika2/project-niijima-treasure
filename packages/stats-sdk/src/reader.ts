import type { DataSource } from './manifest.ts';

/** Plain, serializable shapes handed to extensions. Money is always { amount (minor units), currency }. */
export interface MoneyValue {
	readonly amount: number;
	readonly currency: string;
}

export interface SystemInfo {
	readonly appVersion: string;
	readonly baseCurrency: string;
	readonly locale: string;
	readonly timezone: string;
	readonly snapshot: {
		readonly state: 'saved' | 'pending' | 'never' | 'off' | 'blocked';
		readonly lastSavedAt: string | null;
		readonly problem: string | null;
	};
	readonly drive: { readonly reachable: boolean };
	readonly ratesAsOf: string | null;
}

export interface AccountSummary {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly balance: MoneyValue;
	/** The balance in the base currency, or null when no exchange rate is known yet. */
	readonly baseBalance: MoneyValue | null;
	readonly includeInTotal: boolean;
}

export interface AccountsData {
	readonly accounts: readonly AccountSummary[];
	/** Sum of accounts included in the total, in the base currency. */
	readonly total: MoneyValue;
	/** Currencies left out of the total because no rate is known yet. */
	readonly missingRates: readonly string[];
}

/**
 * The only way an extension reads data. Every method is read-only, and the app hands an
 * extension a reader that refuses sources its extension.yml did not declare under `reads`.
 */
export interface StatsReader {
	system(): Promise<SystemInfo>;
	accounts(): Promise<AccountsData>;
}

export class UndeclaredReadError extends Error {
	constructor(extension: string, source: DataSource) {
		super(
			`Extension "${extension}" read "${source}" without listing it under reads in extension.yml.`
		);
		this.name = 'UndeclaredReadError';
	}
}

/** Wraps a full reader so only the declared sources work. */
export function restrictReader(
	reader: StatsReader,
	extension: string,
	allowed: readonly DataSource[]
): StatsReader {
	const guard = <T>(source: DataSource, read: () => Promise<T>): Promise<T> =>
		allowed.includes(source) ? read() : Promise.reject(new UndeclaredReadError(extension, source));
	return {
		system: () => guard('system', () => reader.system()),
		accounts: () => guard('accounts', () => reader.accounts())
	};
}

/** What an extension's query.ts receives. */
export interface QueryContext<Settings = Record<string, unknown>> {
	readonly stats: StatsReader;
	readonly settings: Settings;
	readonly baseCurrency: string;
	readonly locale: string;
	readonly today: string;
}

/** An extension's query.ts default export: runs on the server, returns plain data for the widget. */
export type ExtensionQuery<Data, Settings = Record<string, unknown>> = (
	context: QueryContext<Settings>
) => Promise<Data> | Data;

/** Typed helper for writing query.ts. */
export function defineQuery<Data, Settings = Record<string, unknown>>(
	query: ExtensionQuery<Data, Settings>
): ExtensionQuery<Data, Settings> {
	return query;
}
