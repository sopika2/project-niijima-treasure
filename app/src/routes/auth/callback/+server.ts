import { redirect } from '@sveltejs/kit';
import { userFromCode } from '#lib/server/discord.ts';
import { log } from '#lib/server/log.ts';
import { runtime } from '#lib/server/runtime.ts';
import { createSession, SESSION_COOKIE, SESSION_DAYS } from '#lib/server/session.ts';
import type { RequestHandler } from './$types';

function page(status: number, title: string, body: string): Response {
	const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><link rel="stylesheet" href="/style.css"><body style="font-family: var(--tr-font-body); background: var(--tr-color-background); color: var(--tr-color-text); padding: 2rem; max-width: 40rem"><h1>${title}</h1>${body}<p><a href="/auth/login" style="color: var(--tr-color-accent)">Try again</a></p></body>`;
	return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** Discord sends you back here after you sign in. */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const app = await runtime();
	if (!app.access.discord) redirect(303, '/');

	const expected = cookies.get('treasure_oauth_state');
	cookies.delete('treasure_oauth_state', { path: '/auth' });
	const code = url.searchParams.get('code');
	if (!code || !expected || url.searchParams.get('state') !== expected) {
		return page(
			400,
			'Sign-in expired',
			'<p>The sign-in link was old or opened in another browser.</p>'
		);
	}

	let user;
	try {
		user = await userFromCode(app.access.discord, code);
	} catch (error) {
		log('auth', `Discord sign-in failed: ${error instanceof Error ? error.message : error}`);
		return page(
			502,
			'Discord sign-in failed',
			'<p>Discord did not confirm the sign-in. Try again in a moment.</p>'
		);
	}

	if (!app.access.allows(user.id)) {
		log('auth', `refused Discord account ${user.id} (${user.name})`);
		return page(
			403,
			'Not on the list',
			`<p>This Discord account is not allowed in. If it is yours, add its id to <code>config.yml</code> and restart:</p>
<pre style="background: var(--tr-color-surface); padding: 1rem">access:
  discord_user_ids:
    - '${user.id}'</pre>`
		);
	}

	cookies.set(SESSION_COOKIE, createSession(user, app.access.sessionSecret), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: SESSION_DAYS * 86_400
	});
	log('auth', `signed in: ${user.name}`);
	redirect(303, '/');
};
