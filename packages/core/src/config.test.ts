import { describe, expect, it } from 'vitest';
import { defaultConfig, parseConfig } from './config.ts';

describe('parseConfig', () => {
	it('fills every default from an empty file', () => {
		const config = defaultConfig();
		expect(config.base_currency).toBe('HUF');
		expect(config.snapshots.delay_minutes).toBe(2);
		expect(config.projection.everyday_spending).toEqual({ mode: 'average', months: 3 });
		expect(config.extensions).toEqual([{ id: 'status-card', settings: {} }]);
	});

	it('normalizes extension entries', () => {
		const config = parseConfig(
			'extensions:\n  - status-card\n  - id: spending-by-category\n    settings:\n      months: 6\n'
		);
		expect(config.extensions).toEqual([
			{ id: 'status-card', settings: {} },
			{ id: 'spending-by-category', settings: { months: 6 } }
		]);
	});

	it('names every problem with its path', () => {
		expect(() =>
			parseConfig(
				'base_currency: XYZ\nsnapshots:\n  delay_minute: 2\nalerts:\n  quiet_hours: late\n'
			)
		).toThrow(
			/base_currency: must be a known 3-letter currency code[\s\S]*snapshots[\s\S]*delay_minute[\s\S]*alerts\.quiet_hours/
		);
	});

	it('reports broken YAML clearly', () => {
		expect(() => parseConfig('base_currency: [HUF')).toThrow(/config\.yml is not valid YAML/);
	});
});
