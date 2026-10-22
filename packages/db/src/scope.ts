import { inArray, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './client.ts';
import { accounts, transactionLegs, type Owner } from './schema.ts';

/**
 * What one persona sees: her own things and the shared ones. Functions that take a scope leave
 * out everything else; without one they see everything (background jobs, backups, exports of
 * the whole database).
 */
export interface Scope {
	readonly owners: readonly Owner[];
}

/** Makoto's or Sae's view: hers and the shared ones. */
export function scopeFor(persona: 'makoto' | 'sae'): Scope {
	return { owners: [persona, 'shared'] };
}

/** `column IN (owners)`, or nothing without a scope. */
export function ownedBy(column: SQLiteColumn, scope?: Scope | null): SQL | undefined {
	return scope ? inArray(column, [...scope.owners]) : undefined;
}

/** Legs on an account the scope can see, or nothing without a scope. */
export function legInScope(db: Db, scope?: Scope | null): SQL | undefined {
	if (!scope) return undefined;
	return inArray(
		transactionLegs.accountId,
		db.select({ id: accounts.id }).from(accounts).where(ownedBy(accounts.owner, scope))
	);
}
