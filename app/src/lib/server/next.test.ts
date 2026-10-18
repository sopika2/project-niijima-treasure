import { describe, expect, it } from 'vitest';
import { safeNext } from './next.ts';

describe('safeNext', () => {
	it('keeps paths on this site', () => {
		expect(safeNext('/transactions?month=2026-10')).toBe('/transactions?month=2026-10');
	});

	it('refuses anything that could leave the site or loop', () => {
		for (const bad of [
			null,
			'',
			'https://evil.example',
			'//evil.example',
			'/\\evil.example',
			'/signin',
			'/auth/login'
		]) {
			expect(safeNext(bad)).toBe('/');
		}
	});
});
