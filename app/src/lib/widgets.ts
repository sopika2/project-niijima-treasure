import type { Component } from 'svelte';

// Every extension's widget, compiled into both the server and the browser bundle.
const modules = import.meta.glob<Component<{ data: unknown; settings: Record<string, unknown> }>>(
	'../../../extensions/*/Widget.svelte',
	{ import: 'default', eager: true }
);

export const widgets: ReadonlyMap<
	string,
	Component<{ data: unknown; settings: Record<string, unknown> }>
> = new Map(
	Object.entries(modules).map(([path, component]) => [path.split('/').at(-2) ?? path, component])
);
