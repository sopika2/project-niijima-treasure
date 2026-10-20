<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		/** Draws the accent stripe; use for the one card that matters most on a page. */
		accent?: boolean;
		/** Spans the full row of the dashboard grid. */
		wide?: boolean;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, accent = false, wide = false, actions, children }: Props = $props();
</script>

<section class="card" class:accent class:wide>
	{#if title || actions}
		<header>
			{#if title}<h2 class="tab">{title}</h2>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="body">{@render children()}</div>
</section>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--tr-space-md);
		padding: var(--tr-space-lg);
		background: var(--tr-color-surface);
		border-radius: var(--tr-radius-lg);
		box-shadow: var(--tr-shadow-card);
		min-width: 0;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.accent {
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--tr-space-sm) var(--tr-space-md);
		margin-block-start: calc(var(--tr-space-sm) * -1);
	}
	/* The card's name is a tilted paper plate pinned to the left edge, like the landing page's. */
	.tab {
		margin: 0 0 0 calc(var(--tr-space-lg) * -1 - 6px);
		padding: 5px var(--tr-space-md) 3px calc(var(--tr-space-lg) + 4px);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-size: var(--tr-text-lg);
		line-height: 1.1;
		box-shadow: 4px 4px 0 var(--tr-color-ink);
		transform: rotate(-2deg);
		transform-origin: bottom left;
	}
	.accent .tab {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--tr-space-sm);
	}
	.body {
		display: grid;
		gap: var(--tr-space-md);
		min-width: 0;
	}

	/* card_style in style.yml */
	:global([data-card='outlined']) .card {
		border: var(--tr-border-width) solid var(--tr-color-border);
	}
	:global([data-card='elevated']) .card {
		background: var(--tr-color-surface-raised);
		box-shadow: var(--tr-shadow-raised);
	}
	:global([data-card='cut']) .card {
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
	}
</style>
