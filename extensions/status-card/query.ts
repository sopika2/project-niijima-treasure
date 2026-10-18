import { defineQuery, type SystemInfo } from '@treasure/stats-sdk';

export interface StatusCardData {
	readonly snapshot: SystemInfo['snapshot'];
	readonly driveReachable: boolean;
	readonly ratesAsOf: string | null;
}

export interface StatusCardSettings {
	readonly show_details: boolean;
}

export default defineQuery<StatusCardData, StatusCardSettings>(async ({ stats }) => {
	const system = await stats.system();
	return {
		snapshot: system.snapshot,
		driveReachable: system.drive.reachable,
		ratesAsOf: system.ratesAsOf
	};
});
