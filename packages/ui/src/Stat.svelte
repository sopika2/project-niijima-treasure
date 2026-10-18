<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		hint?: string;
		children: Snippet;
	}

	let { label, hint, children }: Props = $props();
</script>

<div class="stat">
	<dt>{label}</dt>
	<dd>
		<span class="value">{@render children()}</span>
		{#if hint}<span class="hint">{hint}</span>{/if}
	</dd>
</div>

<style>
	.stat {
		display: grid;
		align-content: start;
		gap: var(--tr-space-xs);
		min-width: 0;
	}
	dt {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
	}
	dd {
		margin: 0;
		display: grid;
		gap: 2px;
	}
	.value {
		font-size: var(--tr-text-md);
		font-weight: var(--tr-weight-bold);
		font-variant-numeric: var(--tr-numeric);
	}
	.hint {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-xs);
	}
</style>
