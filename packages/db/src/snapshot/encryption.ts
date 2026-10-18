import { Decrypter, Encrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';

/**
 * Snapshots are encrypted with age (https://age-encryption.org) using an X25519 key, so a copy
 * can also be opened by hand with the age command-line tool:  age -d -i key.txt latest.db.age
 */
export interface SnapshotKey {
	/** The secret key, "AGE-SECRET-KEY-1…". Keep it in a password manager; without it backups are unreadable. */
	readonly identity: string;
	/** The matching public key, "age1…". */
	readonly recipient: string;
}

const IDENTITY = /^AGE-SECRET-KEY-1[0-9A-Z]+$/;

export class SnapshotKeyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SnapshotKeyError';
	}
}

export async function snapshotKeyFrom(identity: string): Promise<SnapshotKey> {
	const trimmed = identity.trim();
	if (!IDENTITY.test(trimmed)) {
		throw new SnapshotKeyError(
			'SNAPSHOT_KEY must be an age secret key starting with AGE-SECRET-KEY-1 (create one with: pnpm keygen).'
		);
	}
	return { identity: trimmed, recipient: await identityToRecipient(trimmed) };
}

export async function generateSnapshotKey(): Promise<SnapshotKey> {
	return snapshotKeyFrom(await generateX25519Identity());
}

export async function encrypt(data: Uint8Array, key: SnapshotKey): Promise<Uint8Array> {
	const encrypter = new Encrypter();
	encrypter.addRecipient(key.recipient);
	return encrypter.encrypt(data);
}

export async function decrypt(data: Uint8Array, key: SnapshotKey): Promise<Uint8Array> {
	const decrypter = new Decrypter();
	decrypter.addIdentity(key.identity);
	try {
		return await decrypter.decrypt(data, 'uint8array');
	} catch (error) {
		throw new SnapshotKeyError(
			`Could not decrypt the snapshot with SNAPSHOT_KEY: ${error instanceof Error ? error.message : error}. ` +
				'It was probably made with a different key.'
		);
	}
}
