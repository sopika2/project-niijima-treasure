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
		border: var(--tr-border-width) dashed var(--tr-color-border);
		border-radius: var(--tr-radius-lg);
		color: var(--tr-color-text-muted);
	}
	p {
		margin: 0;
		max-width: 60ch;
	}
</style>
