import { parseManifest } from '@treasure/stats-sdk';
import { describe, expect, it } from 'vitest';
import {
	enabledExtensions,
	installedExtensions,
	orderForDashboard,
	type InstalledExtension
} from './extensions.ts';

const fake = (id: string, placement = 'dashboard'): InstalledExtension => ({
	manifest: parseManifest(
		`id: ${id}\nname: ${id}\nversion: 1.0.0\nplacement: ${placement}\nreads: [system]\n`,
		'extension.yml'
	),
	query: null
});

describe('extensions', () => {
	it('finds the shipped status card', () => {
		const installed = installedExtensions();
		expect(installed.get('status-card')?.manifest.reads).toEqual(['system', 'accounts']);
		expect(installed.get('status-card')?.query).toBeTypeOf('function');
	});

	it('names a missing extension in config.yml', () => {
		const installed = new Map([['a', fake('a')]]);
		expect(() => enabledExtensions(installed, [{ id: 'b', settings: {} }])).toThrow(
			/enables extension "b".*Installed: a/
		);
	});

	it('orders the dashboard by style.yml first, then config.yml', () => {
		const installed = new Map(
			['a', 'b', 'c', 'r'].map((id) => [id, fake(id, id === 'r' ? 'reports' : 'dashboard')])
		);
		const enabled = enabledExtensions(
			installed,
			['a', 'b', 'c', 'r'].map((id) => ({ id, settings: {} }))
		);
		expect(orderForDashboard(enabled, ['c']).map((extension) => extension.manifest.id)).toEqual([
			'c',
			'a',
			'b'
		]);
	});
});
