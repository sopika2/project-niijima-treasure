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
	/*
	 * The landing page's button (niijimasisters.com): a paper front on a block offset behind it,
	 * the whole thing tilted. Hover flips the front to ink and pushes the block further out.
	 * Variants change the colours: secondary has a red front, ghost is an outline, danger is red.
	 */
	.button {
		--front: var(--tr-color-paper);
		--label: var(--tr-color-ink);
		--back: var(--tr-color-accent);
		--hover-front: var(--tr-color-ink);
		--hover-label: var(--tr-color-paper);
		--hover-back: var(--tr-color-accent);
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
		color: var(--label);
		font: inherit;
		font-family: var(--tr-font-heading);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--tr-text-md);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transform: rotate(-2deg);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-emphasized),
			color var(--tr-duration-fast);
	}
	.button::before,
	.button::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(3% 6%, 100% 0, 96% 100%, 0 90%);
		transition:
			transform var(--tr-duration-fast) var(--tr-ease-emphasized),
			background-color var(--tr-duration-fast);
	}
	.button::before {
		z-index: -1;
		background: var(--front);
	}
	.button::after {
		z-index: -2;
		background: var(--back);
		transform: translate(5px, 5px);
	}
	.button:hover:not(:disabled),
	.button:focus-visible {
		color: var(--hover-label);
		transform: rotate(-2deg) scale(1.05);
	}
	.button:hover:not(:disabled)::before,
	.button:focus-visible::before {
		background: var(--hover-front);
	}
	.button:hover:not(:disabled)::after,
	.button:focus-visible::after {
		background: var(--hover-back);
		transform: translate(8px, 8px);
	}
	.button:active:not(:disabled) {
		transform: rotate(-2deg) scale(0.97);
	}
	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	/* primary is the landing page's ENTER / PEEK exactly; secondary is the red-fronted one. */
	[data-variant='secondary'] {
		--front: var(--tr-color-accent);
		--label: var(--tr-color-accent-text);
		--back: var(--tr-color-ink);
		--hover-front: var(--tr-color-paper);
		--hover-label: var(--tr-color-ink);
		--hover-back: var(--tr-color-accent);
	}
	[data-variant='ghost'] {
		--front: transparent;
		--label: var(--tr-color-text);
		--back: transparent;
		--hover-back: var(--tr-color-accent);
	}
	[data-variant='ghost']::before {
		box-shadow: inset 0 0 0 var(--tr-border-width) var(--tr-color-text);
	}
	[data-variant='ghost']:hover:not(:disabled)::before {
		box-shadow: none;
	}
	[data-variant='danger'] {
		--front: var(--tr-color-ink);
		--label: var(--tr-color-danger);
		--back: var(--tr-color-danger);
		--hover-front: var(--tr-color-danger);
		--hover-label: var(--tr-color-paper);
		--hover-back: var(--tr-color-paper);
	}
</style>
