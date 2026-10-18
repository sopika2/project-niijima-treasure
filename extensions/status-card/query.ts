import { defineQuery, type AccountsData, type SystemInfo } from '@treasure/stats-sdk';

export interface StatusCardData {
	readonly total: AccountsData['total'];
	readonly accountCount: number;
	readonly missingRates: readonly string[];
	readonly snapshot: SystemInfo['snapshot'];
	readonly driveReachable: boolean;
	readonly ratesAsOf: string | null;
}

export interface StatusCardSettings {
	readonly show_details: boolean;
}

export default defineQuery<StatusCardData, StatusCardSettings>(async ({ stats }) => {
	const [system, accounts] = await Promise.all([stats.system(), stats.accounts()]);
	return {
		total: accounts.total,
		accountCount: accounts.accounts.length,
		missingRates: accounts.missingRates,
		snapshot: system.snapshot,
		driveReachable: system.drive.reachable,
		ratesAsOf: system.ratesAsOf
	};
});
