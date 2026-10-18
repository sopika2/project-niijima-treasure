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
	/* Slanted blocks with a hard offset shadow; the label stays upright. */
	.button {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--tr-space-sm);
		min-height: 2.75rem;
		padding: 0 var(--tr-space-lg);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-family: var(--tr-font-heading);
		font-style: var(--tr-heading-style);
		text-transform: var(--tr-heading-case);
		letter-spacing: var(--tr-heading-spacing);
		font-size: var(--tr-text-md);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: transform var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.button::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		transform: skewX(var(--tr-skew));
		transition: box-shadow var(--tr-duration-fast) var(--tr-ease-standard);
	}
	.button:hover:not(:disabled) {
		transform: translate(-1px, -1px);
	}
	.button:active:not(:disabled) {
		transform: translate(2px, 2px);
	}
	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	[data-variant='primary'] {
		color: var(--tr-color-accent-text);
	}
	[data-variant='primary']::before {
		background: var(--tr-color-accent);
		box-shadow: 4px 4px 0 var(--tr-color-paper);
	}
	[data-variant='secondary'] {
		color: var(--tr-color-secondary-text);
	}
	[data-variant='secondary']::before {
		background: var(--tr-color-secondary);
		box-shadow: 4px 4px 0 var(--tr-color-paper);
	}
	[data-variant='ghost'] {
		color: var(--tr-color-text);
	}
	[data-variant='ghost']::before {
		border: var(--tr-border-width) solid var(--tr-color-text);
	}
	[data-variant='ghost']:hover:not(:disabled) {
		color: var(--tr-color-ink);
	}
	[data-variant='ghost']:hover:not(:disabled)::before {
		background: var(--tr-color-paper);
	}
	[data-variant='danger'] {
		color: var(--tr-color-danger);
	}
	[data-variant='danger']::before {
		border: var(--tr-border-width) solid var(--tr-color-danger);
	}
</style>
