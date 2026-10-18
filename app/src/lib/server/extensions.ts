import type { ExtensionSetting } from '@treasure/core';
import {
	parseManifest,
	resolveSettings,
	type ExtensionManifest,
	type ExtensionQuery
} from '@treasure/stats-sdk';

// Every folder in /extensions is compiled in; config.yml decides which ones run.
const manifestFiles = import.meta.glob<string>('../../../../extensions/*/extension.yml', {
	query: '?raw',
	import: 'default',
	eager: true
});
const queryModules = import.meta.glob<{ default: ExtensionQuery<unknown> }>(
	'../../../../extensions/*/query.ts',
	{ eager: true }
);

const folderOf = (path: string) => path.split('/').at(-2) ?? '';

export interface InstalledExtension {
	readonly manifest: ExtensionManifest;
	readonly query: ExtensionQuery<unknown> | null;
}

export interface EnabledExtension extends InstalledExtension {
	readonly settings: Record<string, unknown>;
}

/** Reads every extension.yml. A broken one stops startup with a message naming the file. */
export function installedExtensions(): Map<string, InstalledExtension> {
	const installed = new Map<string, InstalledExtension>();
	for (const [path, text] of Object.entries(manifestFiles)) {
		const folder = folderOf(path);
		const manifest = parseManifest(text, `extensions/${folder}/extension.yml`);
		if (manifest.id !== folder) {
			throw new Error(
				`extensions/${folder}/extension.yml has id "${manifest.id}"; it must match the folder name.`
			);
		}
		const query = Object.entries(queryModules).find(([file]) => folderOf(file) === folder)?.[1];
		installed.set(manifest.id, { manifest, query: query?.default ?? null });
	}
	return installed;
}

/** The extensions config.yml turns on, with their settings checked against extension.yml. */
export function enabledExtensions(
	installed: Map<string, InstalledExtension>,
	wanted: readonly ExtensionSetting[]
): EnabledExtension[] {
	return wanted.map(({ id, settings }) => {
		const extension = installed.get(id);
		if (!extension) {
			const available = [...installed.keys()].join(', ') || 'none';
			throw new Error(
				`config.yml enables extension "${id}", but there is no extensions/${id}. Installed: ${available}.`
			);
		}
		return { ...extension, settings: resolveSettings(extension.manifest, settings) };
	});
}

/** Dashboard order: style.yml's dashboard_order first, then the rest in config.yml order. */
export function orderForDashboard(
	enabled: readonly EnabledExtension[],
	order: readonly string[]
): EnabledExtension[] {
	const dashboard = enabled.filter((extension) => extension.manifest.placement === 'dashboard');
	const rank = (id: string) => {
		const index = order.indexOf(id);
		return index === -1 ? order.length : index;
	};
	return dashboard
		.map((extension, index) => ({ extension, index }))
		.sort(
			(a, b) => rank(a.extension.manifest.id) - rank(b.extension.manifest.id) || a.index - b.index
		)
		.map(({ extension }) => extension);
}
