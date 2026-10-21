<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'accent' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted';
		children: Snippet;
	}

	let { tone = 'muted', children }: Props = $props();
</script>

<span class="badge" data-tone={tone}>{@render children()}</span>

<style>
	/* The landing page's status stamp: a bordered, tilted label in the display face. */
	.badge {
		display: inline-block;
		padding: 3px 7px 2px;
		border: 2px solid currentColor;
		border-radius: var(--tr-radius-sm);
		font-family: var(--tr-font-heading);
		font-size: var(--tr-text-xs);
		letter-spacing: 0.1em;
		line-height: 1.2;
		text-transform: uppercase;
		transform: rotate(-4deg);
		color: var(--tr-color-text-muted);
		white-space: nowrap;
	}
	[data-tone='accent'] {
		border-color: var(--tr-color-accent);
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	[data-tone='secondary'] {
		border-color: var(--tr-color-ink);
		background: var(--tr-color-sae);
		color: var(--tr-color-ink);
	}
	[data-tone='success'] {
		color: var(--tr-color-success);
	}
	[data-tone='warning'] {
		border-style: dashed;
		color: var(--tr-color-warning);
	}
	[data-tone='danger'] {
		border-color: var(--tr-color-accent);
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	[data-tone='muted'] {
		border-style: dashed;
	}
</style>
