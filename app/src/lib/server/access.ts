import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AccessUser {
	readonly email: string;
}

export interface AccessGate {
	readonly mode: 'cloudflare' | 'off';
	/** Returns the signed-in user, or null when the request is not allowed in. */
	verify(request: Request): Promise<AccessUser | null>;
}

function tokenFrom(request: Request): string | null {
	const header = request.headers.get('cf-access-jwt-assertion');
	if (header) return header;
	const cookie = request.headers.get('cookie') ?? '';
	const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
	return match?.[1] ?? null;
}

/**
 * Checks the token Cloudflare Access attaches to every request it lets through. The app trusts
 * nothing else: a mistake in Traefik or the tunnel can't expose it, because without a token
 * signed by your Access team for this application, every page answers 403.
 */
export function cloudflareAccess(options: {
	readonly teamDomain: string;
	readonly audience: string;
	readonly allowedEmails: readonly string[];
}): AccessGate {
	const team = options.teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const issuer = `https://${team}`;
	const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
	const allowed = options.allowedEmails.map((email) => email.toLowerCase());

	return {
		mode: 'cloudflare',
		async verify(request) {
			const token = tokenFrom(request);
			if (!token) return null;
			try {
				const { payload } = await jwtVerify(token, keys, { issuer, audience: options.audience });
				const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
				if (!email) return null;
				if (allowed.length > 0 && !allowed.includes(email)) return null;
				return { email };
			} catch {
				return null;
			}
		}
	};
}

export function accessOff(): AccessGate {
	return { mode: 'off', verify: async () => null };
}
