import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSetting, openDatabase, setSetting } from './client.ts';
import { accounts, budgets, categories } from './schema.ts';

const migrationsFolder = new URL('../migrations', import.meta.url).pathname;

describe('openDatabase', () => {
	it('creates every table and keeps its instance id across restarts', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'treasury-')), 'treasury.db');
		const first = openDatabase({ path, migrationsFolder });
		const tables = first.sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' ORDER BY name"
			)
			.all()
			.map((row) => (row as { name: string }).name);
		expect(tables).toEqual([
			'accounts',
			'budgets',
			'categories',
			'exchange_rates',
			'goal_contributions',
			'goals',
			'recurring_rules',
			'settings',
			'transaction_legs',
			'transactions'
		]);
		const id = first.instanceId;
		first.close();

		const second = openDatabase({ path, migrationsFolder });
		expect(second.instanceId).toBe(id);
		second.close();
	});

	it('enforces foreign keys and one default budget per category', () => {
		const { db, close } = openDatabase({ path: ':memory:', migrationsFolder });
		expect(() =>
			db.insert(budgets).values({ categoryId: 'missing', limitMinor: 100, currency: 'HUF' }).run()
		).toThrow(/FOREIGN KEY/);

		const [food] = db
			.insert(categories)
			.values({ name: 'Food', kind: 'expense' })
			.returning()
			.all();
		db.insert(budgets).values({ categoryId: food!.id, limitMinor: 100, currency: 'HUF' }).run();
		db.insert(budgets)
			.values({ categoryId: food!.id, month: '2026-10', limitMinor: 200, currency: 'HUF' })
			.run();
		expect(() =>
			db.insert(budgets).values({ categoryId: food!.id, limitMinor: 300, currency: 'HUF' }).run()
		).toThrow(/UNIQUE/);
		close();
	});

	it('stores settings as JSON', () => {
		const { db, close } = openDatabase({ path: ':memory:', migrationsFolder });
		setSetting(db, 'ui', { theme: 'dark', account: null });
		setSetting(db, 'ui', { theme: 'light', account: 'a1' });
		expect(getSetting(db, 'ui')).toEqual({ theme: 'light', account: 'a1' });
		db.insert(accounts)
			.values({ name: 'Cash', type: 'cash', currency: 'HUF', openingDate: '2026-10-18' })
			.run();
		expect(db.select().from(accounts).get()?.includeInTotal).toBe(true);
		close();
	});
});
