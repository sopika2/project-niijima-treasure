import { stringify } from 'yaml';
import type { Db } from './client.ts';
import * as schema from './schema.ts';

/**
 * A human-readable copy of everything you set up (not the transactions themselves):
 * accounts, categories, recurring rules, budgets and treasures. Written to Drive next to the
 * snapshots so you can read or diff your setup without opening the app.
 */
export function exportDefinitions(db: Db, generatedAt = new Date()): string {
	const accounts = db.select().from(schema.accounts).all();
	const categories = db.select().from(schema.categories).all();
	const recurring = db.select().from(schema.recurringRules).all();
	const budgets = db.select().from(schema.budgets).all();
	const goals = db.select().from(schema.goals).all();

	const document = {
		generated_at: generatedAt.toISOString(),
		note: 'Read-only export. Edit these in the app; this file is rewritten after every change.',
		accounts: accounts.map((row) => ({
			id: row.id,
			name: row.name,
			type: row.type,
			currency: row.currency,
			opening_balance_minor: row.openingBalanceMinor,
			opening_date: row.openingDate,
			include_in_total: row.includeInTotal,
			archived: row.archived,
			owner: row.owner
		})),
		categories: categories.map((row) => ({
			id: row.id,
			name: row.name,
			kind: row.kind,
			parent_id: row.parentId,
			archived: row.archived
		})),
		recurring: recurring.map((row) => ({
			id: row.id,
			name: row.name,
			kind: row.kind,
			amount_minor: row.amountMinor,
			currency: row.currency,
			account_id: row.accountId,
			to_account_id: row.toAccountId,
			category_id: row.categoryId,
			rrule: row.rrule,
			start_date: row.startDate,
			end_date: row.endDate,
			auto_post: row.autoPost,
			paused: row.paused
		})),
		budgets: budgets.map((row) => ({
			id: row.id,
			category_id: row.categoryId,
			month: row.month,
			limit_minor: row.limitMinor,
			currency: row.currency,
			rollover: row.rollover,
			owner: row.owner
		})),
		treasures: goals.map((row) => ({
			id: row.id,
			name: row.name,
			target_minor: row.targetMinor,
			currency: row.currency,
			deadline: row.deadline,
			account_id: row.accountId,
			archived: row.archived,
			owner: row.owner
		}))
	};
	return stringify(document, { lineWidth: 0 });
}
