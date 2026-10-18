<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		message: string;
		children?: Snippet;
	}

	let { message, children }: Props = $props();
</script>

<div class="empty">
	<p>{message}</p>
	{#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: start;
		gap: var(--tr-space-md);
		padding: var(--tr-space-xl) var(--tr-space-lg);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-accent);
		background:
			radial-gradient(circle, var(--tr-color-border) 1px, transparent 1.4px) 0 0 / 9px 9px,
			var(--tr-color-surface);
		color: var(--tr-color-text);
		font-size: var(--tr-text-lg);
	}
	p {
		margin: 0;
		max-width: 60ch;
	}
</style>
