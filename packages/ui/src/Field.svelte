<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/** The id of the control inside, so clicking the label focuses it. */
		for?: string;
		hint?: string;
		error?: string | null;
		children: Snippet;
	}

	let { label, for: target, hint, error = null, children }: Props = $props();
</script>

<div class="field" class:invalid={!!error}>
	<label for={target}>{label}</label>
	{@render children()}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{:else if hint}
		<p class="hint">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--tr-space-xs);
		min-width: 0;
	}
	label {
		color: var(--tr-color-text-muted);
		font-size: var(--tr-text-sm);
		font-weight: var(--tr-weight-medium);
	}
	.error,
	.hint {
		margin: 0;
		font-size: var(--tr-text-xs);
	}
	.error {
		color: var(--tr-color-danger);
	}
	.hint {
		color: var(--tr-color-text-muted);
	}
	.invalid :global(:is(input, select, textarea)) {
		border-color: var(--tr-color-danger);
	}
</style>
