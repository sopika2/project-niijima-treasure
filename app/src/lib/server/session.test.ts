import { describe, expect, it } from 'vitest';
import { discordAccess } from './access.ts';
import { createSession, readSession, SESSION_COOKIE } from './session.ts';

const secret = 'test-secret-0123456789abcdef';
const user = { id: '1234567890123456789', name: 'Els' };

describe('login sessions', () => {
	it('reads back a cookie it signed', () => {
		expect(readSession(createSession(user, secret), secret)).toEqual(user);
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
		expect(readSession(value, secret, Date.now() + 31 * 86_400_000)).toBeNull();
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
		expect(gate.verify(cookies(createSession(user, secret)))).toEqual(user);
		expect(
			gate.verify(cookies(createSession({ id: '111111111111111111', name: 'x' }, secret)))
		).toBeNull();
		expect(gate.allows('111111111111111111')).toBe(false);
	});
});
