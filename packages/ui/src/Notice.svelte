<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'warning' | 'danger' | 'info';
		title: string;
		children?: Snippet;
	}

	let { tone = 'warning', title, children }: Props = $props();
</script>

<div class="notice" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
	<strong>{title}</strong>
	{#if children}<div class="body">{@render children()}</div>{/if}
</div>

<style>
	.notice {
		display: grid;
		gap: var(--tr-space-xs);
		padding: var(--tr-space-md);
		border-inline-start: var(--tr-accent-border-width) solid var(--tr-color-warning);
		background: var(--tr-color-surface);
		border-radius: var(--tr-radius-md);
	}
	[data-tone='danger'] {
		border-color: var(--tr-color-danger);
	}
	[data-tone='info'] {
		border-color: var(--tr-color-secondary);
	}
	.body {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
