<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'accent' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted';
		children: Snippet;
	}

	let { tone = 'muted', children }: Props = $props();
</script>

<span class="badge" data-tone={tone}><span class="inner">{@render children()}</span></span>

<style>
	.badge {
		display: inline-block;
		padding: 2px var(--tr-space-sm);
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-bold);
		line-height: 1.5;
		transform: skewX(var(--tr-skew));
		border-radius: var(--tr-radius-sm);
		background: var(--tr-color-surface-raised);
		color: var(--tr-color-text-muted);
		white-space: nowrap;
	}
	.inner {
		display: inline-block;
		transform: skewX(calc(var(--tr-skew) * -1));
	}
	[data-tone='accent'] {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}
	[data-tone='secondary'] {
		background: var(--tr-color-secondary);
		color: var(--tr-color-secondary-text);
	}
	[data-tone='success'] {
		color: var(--tr-color-success);
	}
	[data-tone='warning'] {
		color: var(--tr-color-warning);
	}
	[data-tone='danger'] {
		color: var(--tr-color-danger);
	}
</style>
