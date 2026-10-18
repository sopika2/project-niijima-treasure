<script lang="ts">
	interface Props {
		/** Share filled, 0–1 (above 1 shows as full and overflowing). */
		value: number;
		/** Where you'd be if you were exactly on pace, 0–1. */
		marker?: number | null;
		tone?: 'accent' | 'income' | 'warning' | 'danger' | 'secondary';
		label: string;
	}

	let { value, marker = null, tone = 'accent', label }: Props = $props();
	const shown = $derived(Math.max(0, Math.min(1, value)));
</script>

<div
	class="progress"
	data-tone={tone}
	role="progressbar"
	aria-label={label}
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={Math.round(value * 100)}
>
	<span class="fill" style="--share: {shown}"></span>
	{#if marker !== null}
		<span class="marker" style="--at: {Math.max(0, Math.min(1, marker))}"></span>
	{/if}
</div>

<style>
	.progress {
		position: relative;
		height: 0.9rem;
		background: var(--tr-color-surface-raised);
		transform: skewX(var(--tr-skew));
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0;
		background: var(--tone);
		transform-origin: left;
		transform: scaleX(var(--share));
		transition: transform var(--tr-duration-slow) var(--tr-ease-emphasized);
	}
	.marker {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--at) * 100%);
		width: 3px;
		margin-left: -1.5px;
		background: var(--tr-color-paper);
		mix-blend-mode: difference;
	}
	[data-tone='accent'] {
		--tone: var(--tr-color-accent);
	}
	[data-tone='income'] {
		--tone: var(--tr-color-income);
	}
	[data-tone='warning'] {
		--tone: var(--tr-color-warning);
	}
	[data-tone='danger'] {
		--tone: var(--tr-color-danger);
	}
	[data-tone='secondary'] {
		--tone: var(--tr-color-secondary);
	}
</style>
