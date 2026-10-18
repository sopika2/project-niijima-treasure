import { getContext, setContext } from 'svelte';
import type { Style } from '@treasure/style';

/** What components need from style.yml and config.yml besides CSS variables. */
export interface UiContext {
	readonly copy: Style['copy'];
	readonly layout: Style['layout'];
	readonly charts: Style['charts'];
	readonly locale: string;
	readonly baseCurrency: string;
}

const KEY = Symbol('treasure-ui');

/** Called once by the app's root layout. Pass a getter so a reloaded style.yml flows through. */
export function provideUi(get: () => UiContext): void {
	setContext(KEY, get);
}

/** Read the current words, layout and chart settings inside any component. */
export function useUi(): UiContext {
	const get = getContext<(() => UiContext) | undefined>(KEY);
	if (!get) throw new Error('useUi() needs provideUi() in a parent layout.');
	return {
		get copy() {
			return get().copy;
		},
		get layout() {
			return get().layout;
		},
		get charts() {
			return get().charts;
		},
		get locale() {
			return get().locale;
		},
		get baseCurrency() {
			return get().baseCurrency;
		}
	};
}
