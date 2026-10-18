<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		busy?: boolean;
		/** Renders a link that looks like a button. */
		href?: string;
		children: Snippet;
	}

	let {
		variant = 'primary',
		busy = false,
		type = 'button',
		href,
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a {href} class="button" data-variant={variant}>{@render children()}</a>
{:else}
	<button
		{...rest}
		{type}
		class="button"
		data-variant={variant}
		aria-busy={busy}
		disabled={rest.disabled || busy}
	>
		{@render children()}
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--tr-space-sm);
		min-height: 2.75rem;
		padding: 0 var(--tr-space-md);
		border: var(--tr-border-width) solid transparent;
		border-radius: var(--tr-radius-md);
		font: inherit;
		font-weight: var(--tr-weight-bold);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--tr-duration-fast) var(--tr-ease-standard),
			transform var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.button:active:not(:disabled) {
		transform: translateY(1px);
	}
	.button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	[data-variant='primary'] {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	[data-variant='secondary'] {
		background: var(--tr-color-secondary);
		color: var(--tr-color-secondary-text);
	}
	[data-variant='ghost'] {
		background: transparent;
		color: var(--tr-color-text);
		border-color: var(--tr-color-border);
	}
	[data-variant='ghost']:hover:not(:disabled) {
		background: var(--tr-color-surface-raised);
	}
	[data-variant='danger'] {
		background: transparent;
		color: var(--tr-color-danger);
		border-color: var(--tr-color-danger);
	}
</style>
