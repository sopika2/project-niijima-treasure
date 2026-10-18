import type { IconName } from './Icon.svelte';

export interface NavItem {
	readonly href: string;
	readonly icon: IconName;
	readonly label: string;
	readonly active: boolean;
	/** false keeps it off the phone's bottom bar (it goes under More instead). */
	readonly mobile?: boolean;
}
