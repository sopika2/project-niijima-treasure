import { error, json } from '@sveltejs/kit';
import { isPersona } from '@niijima/design';
import { scopeFor } from '@treasure/db';
import { createHash, timingSafeEqual } from 'node:crypto';
import { runtime } from '#lib/server/runtime.ts';
import { buildSummary } from '#lib/server/summary.ts';
import type { RequestHandler } from './$types';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Read-only feed for the Niijima Network homepage. The homepage calls it over the internal
 * Docker network with `Authorization: Bearer <SUMMARY_TOKEN>`; `?persona=makoto|sae` narrows it
 * to that sister's money and the shared accounts.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const app = await runtime();
	if (!app.summaryToken) error(404, 'Not found');

	const given = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
	if (!timingSafeEqual(digest(given), digest(app.summaryToken)))
		error(401, 'Missing or wrong token');

	const persona = url.searchParams.get('persona');
	if (persona !== null && !isPersona(persona)) error(400, 'persona must be makoto or sae');
	const scope = persona ? scopeFor(persona) : undefined;
	return json(await buildSummary(app, scope), { headers: { 'cache-control': 'no-store' } });
};
