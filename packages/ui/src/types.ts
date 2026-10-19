import type { IconName } from './Icon.svelte';

export interface NavItem {
	readonly href: string;
	readonly icon: IconName;
	readonly label: string;
	readonly active: boolean;
	/** Stable name (the copy.nav key), used to pick per-command art. */
	readonly key?: string;
	/** One line describing the command, shown under the big heading. */
	readonly hint?: string;
}

/** What the command menu shows besides the commands. */
export interface CommandWords {
	readonly heading: string;
	readonly plate: { readonly title: string; readonly hint: string };
	readonly close: string;
	readonly confirm: string;
	readonly move: string;
}

export interface MenuArt {
	readonly default: string | null;
	readonly commands: Readonly<Record<string, string>>;
}
