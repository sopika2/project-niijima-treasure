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
			{#if title}<h2>{title}</h2>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{@render children()}
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
		align-items: baseline;
		justify-content: space-between;
		gap: var(--tr-space-md);
	}
	h2 {
		margin: 0;
		font-size: var(--tr-text-md);
	}
	.actions {
		display: flex;
		gap: var(--tr-space-sm);
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
		border-radius: 0;
		clip-path: polygon(0 0, calc(100% - var(--tr-cut)) 0, 100% var(--tr-cut), 100% 100%, 0 100%);
	}
</style>
