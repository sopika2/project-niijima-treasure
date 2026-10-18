import { building } from '$app/env';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { htmlAttributes } from '@treasure/style';
import { runtime } from '#lib/server/runtime.ts';
import { createSession, SESSION_COOKIE, SESSION_DAYS } from '#lib/server/session.ts';

/**
 * Reachable without signing in: the container health check, the token-protected homepage feed,
 * the sign-in flow itself, and the stylesheet its pages use.
 */
const OPEN_PATHS = new Set([
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

	if (!OPEN_PATHS.has(event.url.pathname) && app.access.mode === 'discord') {
		const user = app.access.verify(event.cookies);
		if (!user) {
			const wantsPage = event.request.method === 'GET' && !event.isDataRequest;
			if (wantsPage) {
				return new Response(null, {
					status: 303,
					headers: { location: '/auth/login', ...SECURITY_HEADERS }
				});
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
				SESSION_COOKIE,
				createSession(event.locals.user, app.access.sessionSecret),
				{
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: event.url.protocol === 'https:',
					maxAge: SESSION_DAYS * 86_400
				}
			);
		}
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
