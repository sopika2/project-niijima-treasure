export * as schema from './schema.ts';
export * from './schema.ts';
export { openDatabase, getSetting, setSetting, totalChanges } from './client.ts';
export type { Db, Treasury, OpenOptions } from './client.ts';
export { exportDefinitions } from './definitions.ts';
export { scopeFor, ownedBy, legInScope } from './scope.ts';
export type { Scope } from './scope.ts';
export { accountBalances, trackingStart } from './repositories/accounts.ts';
export type { AccountBalance } from './repositories/accounts.ts';
export {
	insertRates,
	valuationRate,
	latestMiddleRate,
	ratesFreshness,
	currentRates,
	rateHistory,
	backfillBaseAmounts,
	foreignCurrencies,
	currenciesWithoutRates
} from './repositories/rates.ts';
export type { CurrentRate } from './repositories/rates.ts';
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
	frequentNotes,
	postPending,
	averageDailySpend,
	monthlyTotals,
	exportRows
} from './repositories/transactions.ts';
export {
	listRules,
	getRule,
	createRule,
	updateRule,
	setRuleNextDue,
	setRulePaused,
	deleteRule,
	countPending
} from './repositories/recurring.ts';
export {
	budgetsForMonth,
	setBudget,
	removeBudget,
	listGoals,
	createGoal,
	updateGoal,
	setGoalArchived,
	addContribution,
	contributionTotals,
	recentContributions
} from './repositories/plans.ts';
export type { GoalInput } from './repositories/plans.ts';
export type {
	StoredTransaction,
	TransactionFilter,
	PeriodTotals,
	CategorySpending,
	MonthTotals
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
