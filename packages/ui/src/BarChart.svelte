<script lang="ts">
	import { formatMoney, money } from '@treasure/core';
	import { compact, niceTicks, scale } from './chart.ts';
	import { useUi } from './context.ts';

	interface Series {
		label: string;
		tone: 'income' | 'expense' | 'accent' | 'secondary';
	}

	interface Props {
		label: string;
		series: readonly Series[];
		/** One group per x position (e.g. a month); `values` in the order of `series`, minor units. */
		groups: readonly { label: string; values: readonly number[] }[];
		currency: string;
		height?: number;
	}

	let { label, series, groups, currency, height = 240 }: Props = $props();
	const ui = useUi();
	let width = $state(640);
	let hover = $state<number | null>(null);

	const pad = { top: 12, right: 8, bottom: 28, left: 52 };

	const geometry = $derived.by(() => {
		const values = groups.flatMap((group) => group.values.map((v) => v / 100));
		const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
		const y = scale([ticks[0]!, ticks[ticks.length - 1]!], [height - pad.bottom, pad.top]);
		const inner = Math.max(10, width - pad.left - pad.right);
		const slot = inner / Math.max(1, groups.length);
		const bar = Math.min(28, (slot * 0.72) / Math.max(1, series.length));
		return { y, ticks, slot, bar };
	});

	const format = (minor: number) => formatMoney(money(minor, currency), { locale: ui.locale });
	const summary = $derived(
		`${label}. ${groups.map((g) => `${g.label}: ${g.values.map((v, i) => `${series[i]?.label} ${format(v)}`).join(', ')}`).join('; ')}.`
	);

	function key(event: KeyboardEvent) {
		if (groups.length === 0) return;
		if (event.key === 'ArrowRight') hover = Math.min(groups.length - 1, (hover ?? -1) + 1);
		else if (event.key === 'ArrowLeft') hover = Math.max(0, (hover ?? groups.length) - 1);
		else if (event.key === 'Escape') hover = null;
		else return;
		event.preventDefault();
	}
</script>

<figure class="chart" bind:clientWidth={width} data-tooltip={ui.charts.tooltip}>
	<ul class="legend">
		{#each series as item (item.label)}
			<li data-tone={item.tone}><span class="swatch"></span>{item.label}</li>
		{/each}
	</ul>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<svg
		viewBox="0 0 {width} {height}"
		{height}
		role="img"
		aria-label={summary}
		tabindex="0"
		onkeydown={key}
		onblur={() => (hover = null)}
		onpointerleave={() => (hover = null)}
	>
		{#if ui.charts.grid}
			{#each geometry.ticks as tick (tick)}
				<line
					class="grid"
					class:zero={tick === 0}
					x1={pad.left}
					x2={width - pad.right}
					y1={geometry.y(tick)}
					y2={geometry.y(tick)}
				/>
				<text
					class="axis"
					x={pad.left - 8}
					y={geometry.y(tick)}
					text-anchor="end"
					dominant-baseline="middle">{compact(tick, ui.locale)}</text
				>
			{/each}
		{/if}
		{#each groups as group, g (group.label)}
			{@const x0 = pad.left + g * geometry.slot}
			{@const start =
				x0 + (geometry.slot - geometry.bar * series.length - 2 * (series.length - 1)) / 2}
			<rect
				class="hit"
				class:active={hover === g}
				x={x0}
				y={pad.top}
				width={geometry.slot}
				height={height - pad.top - pad.bottom}
				role="presentation"
				onpointerenter={() => (hover = g)}
			/>
			{#each group.values as value, s (s)}
				{@const top = geometry.y(Math.max(0, value / 100))}
				{@const bottom = geometry.y(Math.min(0, value / 100))}
				<rect
					class="bar"
					data-tone={series[s]?.tone}
					x={start + s * (geometry.bar + 2)}
					y={top}
					width={geometry.bar}
					height={Math.max(value === 0 ? 0 : 1.5, bottom - top)}
				/>
			{/each}
			<text class="axis" x={x0 + geometry.slot / 2} y={height - 8} text-anchor="middle"
				>{group.label}</text
			>
		{/each}
	</svg>
	{#if hover !== null && groups[hover]}
		{@const group = groups[hover]!}
		<div
			class="tip"
			style="--x: {((pad.left + (hover + 0.5) * geometry.slot) / width) * 100}%"
			class:flip={hover > groups.length / 2}
		>
			<span class="tip-date">{group.label}</span>
			{#each group.values as value, s (s)}
				<span class="tip-row" data-tone={series[s]?.tone}
					><span class="swatch"></span>{series[s]?.label} <strong>{format(value)}</strong></span
				>
			{/each}
		</div>
	{/if}
</figure>

<style>
	.chart {
		position: relative;
		margin: 0;
		min-width: 0;
	}
	svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	svg:focus-visible {
		outline: 2px solid var(--tr-color-focus-ring);
		outline-offset: 4px;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tr-space-md);
		margin: 0 0 var(--tr-space-sm);
		padding: 0;
		list-style: none;
		font-size: var(--tr-text-sm);
		color: var(--tr-color-text-muted);
	}
	.legend li,
	.tip-row {
		display: inline-flex;
		align-items: center;
		gap: var(--tr-space-xs);
	}
	.swatch {
		width: 0.7rem;
		height: 0.7rem;
		background: var(--tone);
		transform: skewX(var(--tr-skew));
	}
	[data-tone='income'] {
		--tone: var(--tr-color-income);
	}
	[data-tone='expense'] {
		--tone: var(--tr-color-expense);
	}
	[data-tone='accent'] {
		--tone: var(--tr-color-accent);
	}
	[data-tone='secondary'] {
		--tone: var(--tr-color-secondary);
	}
	.grid {
		stroke: var(--tr-color-border);
	}
	.grid.zero {
		stroke: var(--tr-color-text-muted);
	}
	.axis {
		fill: var(--tr-color-text-muted);
		font-family: var(--tr-font-numbers);
		font-size: 11px;
		font-variant-numeric: var(--tr-numeric);
	}
	.hit {
		fill: transparent;
	}
	.hit.active {
		fill: var(--tr-color-surface-raised);
	}
	.bar {
		fill: var(--tone);
		pointer-events: none;
	}
	.tip {
		position: absolute;
		top: 2rem;
		left: var(--x);
		display: grid;
		gap: 2px;
		padding: var(--tr-space-xs) var(--tr-space-sm);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		box-shadow: 4px 4px 0 var(--tr-color-accent);
		transform: translateX(16px) skewX(var(--tr-skew));
		pointer-events: none;
		white-space: nowrap;
		font-size: var(--tr-text-sm);
	}
	.tip.flip {
		transform: translateX(calc(-100% - 16px)) skewX(var(--tr-skew));
	}
	[data-tooltip='minimal'] .tip {
		background: var(--tr-color-surface);
		color: var(--tr-color-text);
		box-shadow: none;
	}
	.tip strong {
		font-family: var(--tr-font-numbers);
		font-variant-numeric: var(--tr-numeric);
	}
	.tip-date {
		font-size: var(--tr-text-xs);
	}
</style>
