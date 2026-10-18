import { error } from '@sveltejs/kit';
import { isIsoDate } from '@treasure/core';
import { transactionsCsv, transactionsJson } from '#lib/server/exports.ts';
import { today } from '#lib/server/ledger.ts';
import { runtime } from '#lib/server/runtime.ts';
import type { RequestHandler } from './$types';

/** /reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|json, behind the same sign-in. */
export const GET: RequestHandler = async ({ url }) => {
	const app = await runtime();
	const to = url.searchParams.get('to') ?? today(app).day;
	const from = url.searchParams.get('from') ?? `${to.slice(0, 4)}-01-01`;
	if (!isIsoDate(from) || !isIsoDate(to) || from > to) error(400, 'Use from and to as YYYY-MM-DD.');
	const json = url.searchParams.get('format') === 'json';
	const body = json ? transactionsJson(app, from, to) : transactionsCsv(app, from, to);
	return new Response(body, {
		headers: {
			'content-type': json ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="treasury-${from}-${to}.${json ? 'json' : 'csv'}"`,
			'cache-control': 'no-store'
		}
	});
};
