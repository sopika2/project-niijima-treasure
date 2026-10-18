export * as schema from './schema.ts';
export * from './schema.ts';
export { openDatabase, getSetting, setSetting, totalChanges } from './client.ts';
export type { Db, Treasury, OpenOptions } from './client.ts';
export { exportDefinitions } from './definitions.ts';
export { accountBalances } from './repositories/accounts.ts';
export type { AccountBalance } from './repositories/accounts.ts';
export { latestMiddleRate, ratesFreshness } from './repositories/rates.ts';
export {
	listAccounts,
	getAccount,
	accountInUse,
	createAccount,
	updateAccount,
	setAccountArchived,
	AccountLockedError,
	defaultCategories,
	seedCategories,
	listCategories,
	createCategory,
	renameCategory,
	setCategoryArchived,
	categoryUsage,
	DuplicateNameError
} from './repositories/catalog.ts';
export type { AccountInput } from './repositories/catalog.ts';
export {
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction,
	listTransactions,
	periodTotals,
	spendingByCategory,
	frequentNotes
} from './repositories/transactions.ts';
export type {
	StoredTransaction,
	TransactionFilter,
	PeriodTotals,
	CategorySpending
} from './repositories/transactions.ts';
export {
	takeSnapshot,
	restoreIfMissing,
	readManifest,
	SnapshotConflictError
} from './snapshot/snapshot.ts';
export type {
	Manifest,
	SnapshotTarget,
	TakeOptions,
	SnapshotResult,
	RestoreResult
} from './snapshot/snapshot.ts';
export { checkDrive, driveLayout, DriveUnavailableError } from './snapshot/drive.ts';
export type { DriveStatus } from './snapshot/drive.ts';
export { snapshotKeyFrom, generateSnapshotKey, SnapshotKeyError } from './snapshot/encryption.ts';
export type { SnapshotKey } from './snapshot/encryption.ts';
export { SnapshotScheduler } from './snapshot/scheduler.ts';
export type { SchedulerState, SchedulerOptions } from './snapshot/scheduler.ts';
