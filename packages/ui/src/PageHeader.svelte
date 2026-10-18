<script lang="ts">
	import type { Snippet } from 'svelte';
	import Title from './Title.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: Snippet;
	}

	let { title, subtitle, actions }: Props = $props();
</script>

<header class="page-header">
	<div class="text">
		<Title text={title} />
		{#if subtitle}<p class="subtitle"><span>{subtitle}</span></p>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: var(--tr-space-md);
		margin-block-end: var(--tr-space-lg);
	}
	.text {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-sm);
	}
	/* The subtitle sits on a slanted black strip under the title, like a speech caption. */
	.subtitle {
		margin: 0;
		padding: 2px var(--tr-space-sm);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
		transform: skewX(var(--tr-skew));
		font-weight: var(--tr-weight-medium);
	}
	.subtitle span {
		display: inline-block;
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tr-space-sm);
	}
</style>
