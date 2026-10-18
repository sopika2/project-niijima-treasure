import { runtime } from '#lib/server/runtime.ts';
import type { RequestHandler } from './$types';

/** The CSS variables compiled from style.yml. The URL carries the content hash, so it can be cached forever. */
export const GET: RequestHandler = async ({ url, request }) => {
	const app = await runtime();
	const { css, hash } = app.style.current();
	const etag = `"${hash}"`;
	const cache =
		url.searchParams.get('v') === hash ? 'public, max-age=31536000, immutable' : 'no-cache';

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers: { etag, 'cache-control': cache } });
	}
	return new Response(css, {
		headers: { 'content-type': 'text/css; charset=utf-8', etag, 'cache-control': cache }
	});
};
