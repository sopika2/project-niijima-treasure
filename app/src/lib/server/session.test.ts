import { describe, expect, it } from 'vitest';
import { discordAccess } from './access.ts';
import { createSession, readSession, SESSION_COOKIE, SHARED_SESSION_COOKIE } from './session.ts';

const secret = 'test-secret-0123456789abcdef';
const user = { id: '1234567890123456789', name: 'Els' };

describe('login sessions', () => {
	it('reads back a cookie it signed', () => {
		expect(readSession(createSession(user, secret), secret)).toEqual({ ...user, renew: false });
	});

	it('rejects a tampered, foreign or expired cookie', () => {
		const value = createSession(user, secret);
		const [body, signature] = value.split('.');
		const forged = Buffer.from(
			JSON.stringify({ ...user, id: '999999999999999999', exp: 9e9 })
		).toString('base64url');
		expect(readSession(`${forged}.${signature}`, secret)).toBeNull();
		expect(readSession(`${body}.x${signature}`, secret)).toBeNull();
		expect(readSession(value, 'another-secret')).toBeNull();
		expect(readSession(value, secret, Date.now() + 396 * 86_400_000)).toBeNull();
		expect(readSession(undefined, secret)).toBeNull();
	});

	it('only lets in Discord accounts listed in config.yml', () => {
		const gate = discordAccess({
			app: { clientId: 'c', clientSecret: 's', redirectUri: 'https://x/auth/callback' },
			sessionSecret: secret,
			allowedIds: [user.id]
		});
		const cookies = (value: string) => ({
			get: (name: string) => (name === SESSION_COOKIE ? value : undefined)
		});
		expect(gate.verify(cookies(createSession(user, secret)))).toMatchObject(user);
		expect(
			gate.verify(cookies(createSession({ id: '111111111111111111', name: 'x' }, secret)))
		).toBeNull();
		expect(gate.allows('111111111111111111')).toBe(false);
	});

	it('shares sign-in across the domain, and still accepts the app-only cookie', () => {
		const gate = discordAccess({
			app: { clientId: 'c', clientSecret: 's', redirectUri: 'https://x/auth/callback' },
			sessionSecret: secret,
			allowedIds: [user.id],
			domain: 'niijimasisters.com'
		});
		expect(gate.cookie).toEqual({ name: SHARED_SESSION_COOKIE, domain: 'niijimasisters.com' });
		const value = createSession(user, secret);
		const only = (wanted: string) => ({
			get: (name: string) => (name === wanted ? value : undefined)
		});
		expect(gate.verify(only(SHARED_SESSION_COOKIE))).toMatchObject(user);
		expect(gate.verify(only(SESSION_COOKIE))).toMatchObject(user);
		expect(gate.verify(only('other'))).toBeNull();
	});

	it('asks to renew once the cookie is a day old, so the login never runs out while used', () => {
		const issued = Date.now();
		const value = createSession(user, secret, issued);
		expect(readSession(value, secret, issued + 3_600_000)?.renew).toBe(false);
		expect(readSession(value, secret, issued + 2 * 86_400_000)?.renew).toBe(true);
	});
});
