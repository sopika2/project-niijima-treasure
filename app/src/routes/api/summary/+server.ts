import { error, json } from '@sveltejs/kit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { runtime } from '#lib/server/runtime.ts';
import { buildSummary } from '#lib/server/summary.ts';
import type { RequestHandler } from './$types';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Read-only feed for the Niijima Network homepage. The homepage calls it over the internal
 * Docker network with `Authorization: Bearer <SUMMARY_TOKEN>`.
 */
export const GET: RequestHandler = async ({ request }) => {
	const app = await runtime();
	if (!app.summaryToken) error(404, 'Not found');

	const given = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
	if (!timingSafeEqual(digest(given), digest(app.summaryToken)))
		error(401, 'Missing or wrong token');

	return json(await buildSummary(app), { headers: { 'cache-control': 'no-store' } });
};
