import { building } from '$app/env';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { htmlAttributes } from '@treasure/style';
import { runtime } from '#lib/server/runtime.ts';

/** Paths reachable without a Cloudflare Access login: the container health check and the token-protected homepage feed. */
const OPEN_PATHS = new Set(['/healthz', '/api/summary']);

const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'no-referrer',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
	'cross-origin-opener-policy': 'same-origin'
};

export const init: ServerInit = async () => {
	if (!building) await runtime();
};

export const handle: Handle = async ({ event, resolve }) => {
	const app = await runtime();
	event.locals.user = null;

	if (!OPEN_PATHS.has(event.url.pathname) && app.access.mode === 'cloudflare') {
		const user = await app.access.verify(event.request);
		if (!user) {
			return new Response('Access denied. Sign in through Cloudflare Access.', {
				status: 403,
				headers: { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }
			});
		}
		event.locals.user = user;
	}

	const attributes = Object.entries(htmlAttributes(app.style.current().style))
		.map(([name, value]) => `${name}="${value}"`)
		.join(' ');

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%treasure.html_attributes%', attributes)
	});
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
