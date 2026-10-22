import type { DiscordApp } from './discord.ts';
import {
	readSession,
	SESSION_COOKIE,
	sessionCookie,
	type ReadSession,
	type SessionCookie,
	type SessionUser
} from './session.ts';

export type AccessUser = SessionUser;
export type VerifiedUser = ReadSession;

export interface AccessGate {
	readonly mode: 'discord' | 'off';
	/** Returns the signed-in user, or null when the request is not allowed in. */
	verify(cookies: { get(name: string): string | undefined }): VerifiedUser | null;
	/** Whether a Discord account may use the app. */
	allows(discordId: string): boolean;
	readonly discord: DiscordApp | null;
	readonly sessionSecret: string;
	/** The cookie sign-in is kept in. */
	readonly cookie: SessionCookie;
}

/**
 * Only the Discord accounts listed in config.yml (access.discord_user_ids) get in. The list is
 * checked on every request, so removing an id signs that account out straight away.
 */
export function discordAccess(options: {
	readonly app: DiscordApp;
	readonly sessionSecret: string;
	readonly allowedIds: readonly string[];
	readonly domain?: string;
}): AccessGate {
	const allowed = new Set(options.allowedIds);
	const cookie = sessionCookie(options.domain);
	// The app-only cookie still counts after switching to a shared one, so nobody is signed out.
	const names = [...new Set([cookie.name, SESSION_COOKIE])];
	return {
		mode: 'discord',
		discord: options.app,
		sessionSecret: options.sessionSecret,
		cookie,
		allows: (id) => allowed.has(id),
		verify(cookies) {
			for (const name of names) {
				const user = readSession(cookies.get(name), options.sessionSecret);
				if (user && allowed.has(user.id)) return user;
			}
			return null;
		}
	};
}

export function accessOff(): AccessGate {
	return {
		mode: 'off',
		discord: null,
		sessionSecret: '',
		cookie: sessionCookie(undefined),
		allows: () => true,
		verify: () => null
	};
}
