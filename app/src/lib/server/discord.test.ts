import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeUrl, userFromCode } from './discord.ts';

const app = {
	clientId: '111',
	clientSecret: 'shh',
	redirectUri: 'https://t.example/auth/callback'
};

afterEach(() => vi.unstubAllGlobals());

describe('Discord sign-in', () => {
	it('asks only for the identify scope', () => {
		const url = new URL(authorizeUrl(app, 'state-1'));
		expect(url.searchParams.get('scope')).toBe('identify');
		expect(url.searchParams.get('redirect_uri')).toBe(app.redirectUri);
		expect(url.searchParams.get('state')).toBe('state-1');
	});

	it('trades the code for the user id and display name', async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) =>
			String(input).endsWith('/oauth2/token')
				? Response.json({ access_token: 'tok' })
				: Response.json({ id: '1234567890123456789', username: 'els', global_name: 'Els' })
		);
		vi.stubGlobal('fetch', fetchMock);
		expect(await userFromCode(app, 'code-1')).toEqual({ id: '1234567890123456789', name: 'Els' });
		const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
		expect(body).toContain('code=code-1');
		expect(body).toContain('client_secret=shh');
	});

	it('fails clearly when Discord refuses the code', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}', { status: 400 }))
		);
		await expect(userFromCode(app, 'bad')).rejects.toThrow(/refused the sign-in code \(400\)/);
	});
});
