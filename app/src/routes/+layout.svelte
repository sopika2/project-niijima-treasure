<script lang="ts">
	import '@treasure/ui/base.css';
	import { provideUi } from '@treasure/ui';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	provideUi(() => data.ui);
</script>

<svelte:head>
	<link rel="stylesheet" href="/fonts/fonts.css" />
	<link rel="stylesheet" href="/style.css?v={data.styleHash}" />
	{#if data.favicon}<link rel="icon" href={data.favicon} />{/if}
	<title>{data.ui.copy.app_name}</title>
</svelte:head>

{@render children()}
