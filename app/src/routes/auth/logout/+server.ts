import { redirect } from '@sveltejs/kit';
import { runtime } from '#lib/server/runtime.ts';
import { SESSION_COOKIE } from '#lib/server/session.ts';
import type { RequestHandler } from './$types';

/** Signs you out on this device (of every Niijima app, when sign-in is shared). */
export const POST: RequestHandler = async ({ cookies }) => {
	const app = await runtime();
	const { name, domain } = app.access.cookie;
	cookies.delete(name, { path: '/', domain });
	if (name !== SESSION_COOKIE) cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/signin?m=signed_out');
};
