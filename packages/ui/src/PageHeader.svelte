<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: Snippet;
	}

	let { title, subtitle, actions }: Props = $props();
</script>

<header class="page-header">
	<div>
		<h1>{title}</h1>
		{#if subtitle}<p>{subtitle}</p>{/if}
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
	h1 {
		margin: 0;
		font-size: var(--tr-text-xxl);
		line-height: 1;
	}
	p {
		margin: var(--tr-space-sm) 0 0;
		color: var(--tr-color-text-muted);
	}
	.actions {
		display: flex;
		gap: var(--tr-space-sm);
	}
</style>
