import { redirect } from '@sveltejs/kit';
import { authorizeUrl } from '#lib/server/discord.ts';
import { runtime } from '#lib/server/runtime.ts';
import { randomState } from '#lib/server/session.ts';
import type { RequestHandler } from './$types';

/** Sends you to Discord to sign in. */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const app = await runtime();
	if (!app.access.discord) redirect(303, '/');

	const state = randomState();
	cookies.set('treasure_oauth_state', state, {
		path: '/auth',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 600
	});
	// SvelteKit's redirect() only allows same-site targets; Discord is deliberate here.
	return new Response(null, {
		status: 303,
		headers: { location: authorizeUrl(app.access.discord, state) }
	});
};
