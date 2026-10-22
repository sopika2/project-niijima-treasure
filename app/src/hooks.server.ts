import { building } from '$app/env';
import { personaFromCookie } from '@niijima/design';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { htmlAttributes } from '@treasure/style';
import { runtime } from '#lib/server/runtime.ts';
import { createSession, sessionCookieOptions } from '#lib/server/session.ts';

/**
 * Reachable without signing in: the container health check, the token-protected homepage feed,
 * the sign-in screen and flow, and the stylesheet they use.
 */
const OPEN_PATHS = new Set([
	'/signin',
	'/healthz',
	'/api/summary',
	'/style.css',
	'/auth/login',
	'/auth/callback'
]);

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
	event.locals.persona = personaFromCookie(event.request.headers.get('cookie')) ?? 'makoto';

	if (!OPEN_PATHS.has(event.url.pathname) && app.access.mode === 'discord') {
		const user = app.access.verify(event.cookies);
		if (!user) {
			const wantsPage = event.request.method === 'GET' && !event.isDataRequest;
			if (wantsPage) {
				const target = event.url.pathname + event.url.search;
				const location = target === '/' ? '/signin' : `/signin?next=${encodeURIComponent(target)}`;
				return new Response(null, { status: 303, headers: { location, ...SECURITY_HEADERS } });
			}
			return new Response('Sign in first.', {
				status: 401,
				headers: { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }
			});
		}
		event.locals.user = { id: user.id, name: user.name };
		// Sliding login: each visit pushes the expiry forward, so you only sign in once.
		if (user.renew) {
			event.cookies.set(
				app.access.cookie.name,
				createSession(event.locals.user, app.access.sessionSecret),
				sessionCookieOptions(app.access.cookie, event.url.protocol === 'https:')
			);
		}
	}

	const attributes = Object.entries({
		...htmlAttributes(app.style.current().style),
		'data-persona': event.locals.persona
	})
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
