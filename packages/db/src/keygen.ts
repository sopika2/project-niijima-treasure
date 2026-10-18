#!/usr/bin/env node
/**
 * Creates the key that encrypts snapshots on Drive.
 *
 *   pnpm keygen
 *
 * Put the SNAPSHOT_KEY line in .env and also store it in a password manager.
 * Without it, the snapshots on Drive cannot be opened, by you or anyone else.
 */
import { generateSnapshotKey } from './snapshot/encryption.ts';

const key = await generateSnapshotKey();
console.log(`SNAPSHOT_KEY=${key.identity}`);
console.error(`\nPublic key (safe to share, not needed by the app): ${key.recipient}`);
console.error(
	'Keep SNAPSHOT_KEY in your .env and in a password manager. Lose it and the Drive backups are unreadable.'
);
