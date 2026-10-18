import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cloudflareAccess } from './access.ts';

const team = 'niijima.cloudflareaccess.com';
const audience = 'aud-tag-123';
let privateKey: CryptoKey;

beforeAll(async () => {
	const pair = await generateKeyPair('RS256');
	privateKey = pair.privateKey;
	const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: [jwk] }), {
					headers: { 'content-type': 'application/json' }
				})
		)
	);
});

afterEach(() => vi.clearAllMocks());

const token = (claims: { aud?: string; iss?: string; email?: string; expiresIn?: string } = {}) =>
	new SignJWT({ email: claims.email ?? 'els@niijimasisters.com' })
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(claims.iss ?? `https://${team}`)
		.setAudience(claims.aud ?? audience)
		.setIssuedAt()
		.setExpirationTime(claims.expiresIn ?? '1h')
		.sign(privateKey);

const request = (headers: Record<string, string>) =>
	new Request('https://treasure.example/', { headers });

describe('cloudflareAccess', () => {
	const gate = cloudflareAccess({ teamDomain: team, audience, allowedEmails: [] });

	it('lets in a request carrying a valid Access token', async () => {
		const user = await gate.verify(request({ 'cf-access-jwt-assertion': await token() }));
		expect(user).toEqual({ email: 'els@niijimasisters.com' });
	});

	it('also reads the CF_Authorization cookie', async () => {
		const user = await gate.verify(request({ cookie: `a=b; CF_Authorization=${await token()}` }));
		expect(user?.email).toBe('els@niijimasisters.com');
	});

	it('refuses missing, foreign, expired or wrongly addressed tokens', async () => {
		expect(await gate.verify(request({}))).toBeNull();
		expect(await gate.verify(request({ 'cf-access-jwt-assertion': 'not-a-jwt' }))).toBeNull();
		expect(
			await gate.verify(request({ 'cf-access-jwt-assertion': await token({ aud: 'other-app' }) }))
		).toBeNull();
		expect(
			await gate.verify(
				request({
					'cf-access-jwt-assertion': await token({ iss: 'https://evil.cloudflareaccess.com' })
				})
			)
		).toBeNull();
		expect(
			await gate.verify(request({ 'cf-access-jwt-assertion': await token({ expiresIn: '-1m' }) }))
		).toBeNull();
	});

	it('applies the optional email allow-list', async () => {
		const strict = cloudflareAccess({
			teamDomain: team,
			audience,
			allowedEmails: ['Els@NiijimaSisters.com']
		});
		expect(
			await strict.verify(request({ 'cf-access-jwt-assertion': await token() }))
		).not.toBeNull();
		expect(
			await strict.verify(
				request({ 'cf-access-jwt-assertion': await token({ email: 'someone@else.com' }) })
			)
		).toBeNull();
	});
});
