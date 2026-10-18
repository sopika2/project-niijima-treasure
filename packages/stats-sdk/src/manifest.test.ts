import { describe, expect, it } from 'vitest';
import { parseManifest, resolveSettings } from './manifest.ts';
import { restrictReader, UndeclaredReadError, type StatsReader } from './reader.ts';

const manifest = parseManifest(
	[
		'id: spending-chart',
		'name: Spending',
		'version: 1.0.0',
		'placement: dashboard',
		'reads: [accounts]',
		'settings:',
		'  months: { type: number, default: 3, min: 1, max: 12 }',
		'  style: { type: choice, options: [bars, lines], default: bars }'
	].join('\n'),
	'extension.yml'
);

describe('extension manifests', () => {
	it('fill defaults', () => {
		expect(manifest.size).toBe('normal');
		expect(resolveSettings(manifest, {})).toEqual({ months: 3, style: 'bars' });
		expect(resolveSettings(manifest, { months: 6 })).toEqual({ months: 6, style: 'bars' });
	});

	it('reject unknown or invalid settings from config.yml', () => {
		expect(() => resolveSettings(manifest, { mnths: 6 })).toThrow(/"mnths" is not a setting/);
		expect(() => resolveSettings(manifest, { months: 40 })).toThrow(
			/months must be a valid number/
		);
		expect(() => resolveSettings(manifest, { style: 'pie' })).toThrow(
			/style must be a valid choice/
		);
	});

	it('reject a malformed extension.yml', () => {
		expect(() => parseManifest('id: Bad Name\nname: x\nversion: 1\n', 'extension.yml')).toThrow(
			/id: use lowercase[\s\S]*version[\s\S]*placement[\s\S]*reads/
		);
	});
});

describe('restrictReader', () => {
	it('only lets an extension read what it declared', async () => {
		const full: StatsReader = {
			system: async () => {
				throw new Error('should not be called');
			},
			accounts: async () => ({
				accounts: [],
				total: { amount: 0, currency: 'HUF' },
				missingRates: []
			})
		};
		const reader = restrictReader(full, 'spending-chart', manifest.reads);
		await expect(reader.accounts()).resolves.toMatchObject({ accounts: [] });
		await expect(reader.system()).rejects.toBeInstanceOf(UndeclaredReadError);
	});
});
