import { toDecimalString, money } from '@treasure/core';
import {
	exportRows,
	listAccounts,
	listCategories,
	rateHistory,
	foreignCurrencies
} from '@treasure/db';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { monthRange, shiftMonth, today } from './ledger.ts';
import { log, logError } from './log.ts';
import type { Runtime } from './runtime.ts';

const HEADER = [
	'date',
	'kind',
	'status',
	'account',
	'category',
	'amount',
	'currency',
	'amount_base',
	'base_currency',
	'rate',
	'note',
	'transaction_id'
];

/** A spreadsheet-safe cell: quoted when needed, and never read as a formula. */
function cell(value: string | number | null): string {
	if (value === null) return '';
	let text = String(value);
	if (/^[=+\-@\t\r]/.test(text) && !/^-?\d/.test(text)) text = `'${text}`;
	return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rows(app: Runtime, from: string, to: string) {
	const { db } = app.treasury;
	const base = app.config.base_currency;
	const accounts = new Map(
		listAccounts(db, { includeArchived: true }).map((row) => [row.id, row.name])
	);
	const categories = new Map(
		listCategories(db, { includeArchived: true }).map((row) => [row.id, row.name])
	);
	return exportRows(db, from, to).map((row) => ({
		date: row.date,
		kind: row.kind,
		status: row.status,
		account: accounts.get(row.accountId) ?? '',
		category: row.categoryId ? (categories.get(row.categoryId) ?? '') : '',
		amount: toDecimalString(money(row.amountMinor, row.currency)),
		currency: row.currency,
		amount_base:
			row.baseAmountMinor === null ? null : toDecimalString(money(row.baseAmountMinor, base)),
		base_currency: base,
		rate: row.rate,
		note: row.note,
		transaction_id: row.id
	}));
}

/** One line per account entry (a transfer has two), decimal point, UTF-8 with a BOM for Excel. */
export function transactionsCsv(app: Runtime, from: string, to: string): string {
	const lines = [HEADER.join(',')];
	for (const row of rows(app, from, to)) {
		lines.push(HEADER.map((key) => cell(row[key as keyof typeof row] ?? null)).join(','));
	}
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function transactionsJson(app: Runtime, from: string, to: string): string {
	return `${JSON.stringify({ from, to, generated_at: new Date().toISOString(), entries: rows(app, from, to) }, null, 2)}\n`;
}

function writeAtomic(path: string, text: string): void {
	const partial = `${path}.partial`;
	writeFileSync(partial, text);
	renameSync(partial, path);
}

/**
 * The nightly copy on Drive: exports/YYYY-MM.csv for this month and last month, and
 * rates/YYYY-MM.csv with each day's value of every foreign currency.
 */
export function writeDriveExports(app: Runtime): void {
	try {
		const { month } = today(app);
		const exportsDir = join(app.paths.drive, 'exports');
		const ratesDir = join(app.paths.drive, 'rates');
		mkdirSync(exportsDir, { recursive: true });
		mkdirSync(ratesDir, { recursive: true });
		for (const which of [shiftMonth(month, -1), month]) {
			const { from, to } = monthRange(which);
			writeAtomic(join(exportsDir, `${which}.csv`), transactionsCsv(app, from, to));
			const base = app.config.base_currency;
			const lines = ['date,currency,rate,base_currency'];
			for (const currency of foreignCurrencies(app.treasury.db, base)) {
				for (const point of rateHistory(app.treasury.db, currency, base, from, to)) {
					lines.push([point.day, currency, point.rate, base].join(','));
				}
			}
			writeAtomic(join(ratesDir, `${which}.csv`), `${lines.join('\r\n')}\r\n`);
		}
		log('exports', `wrote ${month} and the month before to Drive`);
	} catch (error) {
		logError('exports', error);
	}
}
