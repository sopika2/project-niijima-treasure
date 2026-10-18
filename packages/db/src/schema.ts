import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';

/*
 * Ten tables. Money is always an integer number of minor units (fillér, cents) next to its
 * currency code. Dates are ISO text (YYYY-MM-DD), timestamps ISO 8601 in UTC.
 * Nothing that history depends on is hard-deleted: accounts and categories are archived,
 * transactions are marked deleted.
 */

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const now = () => new Date().toISOString();
const createdAt = () => text('created_at').notNull().$defaultFn(now);
const updatedAt = () => text('updated_at').notNull().$defaultFn(now).$onUpdateFn(now);
const flag = (name: string) => integer(name, { mode: 'boolean' });

export const accountTypes = ['current', 'savings', 'cash', 'card', 'other'] as const;
export const categoryKinds = ['income', 'expense'] as const;
export const transactionKinds = ['income', 'expense', 'transfer'] as const;
export const transactionStatuses = ['posted', 'pending'] as const;
export const rateTypes = [
	'card_buy',
	'card_sell',
	'account_buy',
	'account_sell',
	'middle',
	'official'
] as const;
export const rateSources = ['otp', 'mnb', 'manual'] as const;

export const accounts = sqliteTable('accounts', {
	id: id(),
	name: text('name').notNull(),
	type: text('type', { enum: accountTypes }).notNull(),
	currency: text('currency').notNull(),
	openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
	openingDate: text('opening_date').notNull(),
	includeInTotal: flag('include_in_total').notNull().default(true),
	archived: flag('archived').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const categories = sqliteTable(
	'categories',
	{
		id: id(),
		name: text('name').notNull(),
		kind: text('kind', { enum: categoryKinds }).notNull(),
		parentId: text('parent_id').references((): AnySQLiteColumn => categories.id),
		color: text('color'),
		icon: text('icon'),
		archived: flag('archived').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt()
	},
	(table) => [index('categories_parent_idx').on(table.parentId)]
);

export const recurringRules = sqliteTable(
	'recurring_rules',
	{
		id: id(),
		name: text('name').notNull(),
		kind: text('kind', { enum: transactionKinds }).notNull(),
		amountMinor: integer('amount_minor').notNull(),
		currency: text('currency').notNull(),
		accountId: text('account_id')
			.notNull()
			.references(() => accounts.id),
		toAccountId: text('to_account_id').references(() => accounts.id),
		categoryId: text('category_id').references(() => categories.id),
		/** Schedule as an RFC 5545 recurrence rule, e.g. FREQ=MONTHLY;BYMONTHDAY=1 */
		rrule: text('rrule').notNull(),
		startDate: text('start_date').notNull(),
		endDate: text('end_date'),
		autoPost: flag('auto_post').notNull().default(false),
		amountVaries: flag('amount_varies').notNull().default(false),
		paused: flag('paused').notNull().default(false),
		nextDue: text('next_due'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('recurring_next_due_idx').on(table.nextDue)]
);

export const exchangeRates = sqliteTable(
	'exchange_rates',
	{
		id: id(),
		fetchedAt: text('fetched_at').notNull().$defaultFn(now),
		/** When this quote starts to apply (OTP quotes are valid until the next one). */
		validFrom: text('valid_from').notNull(),
		/** The foreign currency, e.g. EUR. */
		currency: text('currency').notNull(),
		/** What the rate is expressed in, e.g. HUF: units of quote_currency for one unit of currency. */
		quoteCurrency: text('quote_currency').notNull(),
		rateType: text('rate_type', { enum: rateTypes }).notNull(),
		/** Exact decimal text as published, e.g. "395.12". */
		rate: text('rate').notNull(),
		source: text('source', { enum: rateSources }).notNull()
	},
	(table) => [
		index('rates_lookup_idx').on(table.currency, table.rateType, table.validFrom),
		uniqueIndex('rates_unique_quote_idx').on(
			table.currency,
			table.quoteCurrency,
			table.rateType,
			table.validFrom,
			table.source
		)
	]
);

export const transactions = sqliteTable(
	'transactions',
	{
		id: id(),
		date: text('date').notNull(),
		kind: text('kind', { enum: transactionKinds }).notNull(),
		note: text('note'),
		recurringId: text('recurring_id').references(() => recurringRules.id),
		status: text('status', { enum: transactionStatuses }).notNull().default('posted'),
		deletedAt: text('deleted_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('transactions_date_idx').on(table.date),
		index('transactions_recurring_idx').on(table.recurringId)
	]
);

export const transactionLegs = sqliteTable(
	'transaction_legs',
	{
		id: id(),
		transactionId: text('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		accountId: text('account_id')
			.notNull()
			.references(() => accounts.id),
		/** Signed: money leaving the account is negative. */
		amountMinor: integer('amount_minor').notNull(),
		currency: text('currency').notNull(),
		categoryId: text('category_id').references(() => categories.id),
		/** The same amount in the base currency at the time, so past reports never shift. */
		baseAmountMinor: integer('base_amount_minor').notNull(),
		/** The exact rate used for base_amount_minor; null when already in the base currency. */
		rate: text('rate'),
		rateId: text('rate_id').references(() => exchangeRates.id)
	},
	(table) => [
		index('legs_transaction_idx').on(table.transactionId),
		index('legs_account_idx').on(table.accountId),
		index('legs_category_idx').on(table.categoryId)
	]
);

export const budgets = sqliteTable(
	'budgets',
	{
		id: id(),
		categoryId: text('category_id')
			.notNull()
			.references(() => categories.id),
		/** YYYY-MM for one month, or null for the default limit of every month. */
		month: text('month'),
		limitMinor: integer('limit_minor').notNull(),
		currency: text('currency').notNull(),
		rollover: flag('rollover').notNull().default(false),
		createdAt: createdAt()
	},
	(table) => [
		// One limit per category per month, and one default (month = null) per category.
		uniqueIndex('budgets_category_month_idx')
			.on(table.categoryId, table.month)
			.where(sql`${table.month} is not null`),
		uniqueIndex('budgets_category_default_idx')
			.on(table.categoryId)
			.where(sql`${table.month} is null`),
		check('budgets_limit_positive', sql`${table.limitMinor} > 0`)
	]
);

/** Savings goals, shown as "Treasures" by default (the word comes from style.yml). */
export const goals = sqliteTable('goals', {
	id: id(),
	name: text('name').notNull(),
	targetMinor: integer('target_minor').notNull(),
	currency: text('currency').notNull(),
	deadline: text('deadline'),
	/** When set, progress is this account's balance; otherwise the sum of contributions. */
	accountId: text('account_id').references(() => accounts.id),
	archived: flag('archived').notNull().default(false),
	createdAt: createdAt()
});

export const goalContributions = sqliteTable(
	'goal_contributions',
	{
		id: id(),
		goalId: text('goal_id')
			.notNull()
			.references(() => goals.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		amountMinor: integer('amount_minor').notNull(),
		transactionId: text('transaction_id').references(() => transactions.id),
		createdAt: createdAt()
	},
	(table) => [index('contributions_goal_idx').on(table.goalId)]
);

/** Small UI preferences and internal markers. Real settings live in config.yml. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull(),
	updatedAt: updatedAt()
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionLeg = typeof transactionLegs.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
