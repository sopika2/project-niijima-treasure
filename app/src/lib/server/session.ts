import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Who is signed in. Kept in a signed cookie, so no session table is needed. */
export interface SessionUser {
	readonly id: string;
	readonly name: string;
}

interface Payload extends SessionUser {
	/** Expiry, in seconds since 1970. */
	readonly exp: number;
}

export const SESSION_COOKIE = 'treasure_session';
export const SESSION_DAYS = 30;

const encode = (text: string) => Buffer.from(text).toString('base64url');
const decode = (text: string) => Buffer.from(text, 'base64url').toString('utf8');

function sign(body: string, secret: string): string {
	return createHmac('sha256', secret).update(body).digest('base64url');
}

/** A cookie value proving `user` signed in, valid for `days`. */
export function createSession(user: SessionUser, secret: string, now = Date.now()): string {
	const payload: Payload = { ...user, exp: Math.floor(now / 1000) + SESSION_DAYS * 86_400 };
	const body = encode(JSON.stringify(payload));
	return `${body}.${sign(body, secret)}`;
}

/** The user in a cookie value, or null when it is missing, tampered with or expired. */
export function readSession(
	value: string | undefined,
	secret: string,
	now = Date.now()
): SessionUser | null {
	if (!value) return null;
	const [body, signature] = value.split('.');
	if (!body || !signature) return null;
	const expected = Buffer.from(sign(body, secret));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	try {
		const payload = JSON.parse(decode(body)) as Payload;
		if (typeof payload.id !== 'string' || payload.exp * 1000 < now) return null;
		return { id: payload.id, name: String(payload.name ?? '') };
	} catch {
		return null;
	}
}

/** A random value for the OAuth `state` check. */
export function randomState(): string {
	return randomBytes(24).toString('base64url');
}
