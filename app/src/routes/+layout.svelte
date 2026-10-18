<script lang="ts">
	import '@treasure/ui/base.css';
	import { page } from '$app/state';
	import { Notice, provideUi, Shell } from '@treasure/ui';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	provideUi(() => data.ui);

	const copy = $derived(data.ui.copy);
	const nav = $derived(
		[
			{ href: '/', label: copy.nav.dashboard },
			{ href: '/system', label: copy.nav.system }
		].map((item) => ({
			...item,
			active:
				item.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(item.href)
		}))
	);
</script>

<svelte:head>
	<link rel="stylesheet" href="/style.css?v={data.styleHash}" />
	{#if data.favicon}<link rel="icon" href={data.favicon} />{/if}
	<title>{copy.app_name}</title>
</svelte:head>

{#snippet problems()}
	{#each data.problems as problem (problem.title)}
		<Notice tone={problem.tone} title={problem.title}>{problem.detail}</Notice>
	{/each}
{/snippet}

<Shell
	appName={copy.app_name}
	logo={data.logo}
	{nav}
	banner={data.problems.length > 0 ? problems : undefined}
>
	{@render children()}
</Shell>
