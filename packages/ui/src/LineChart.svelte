<script lang="ts">
	import { formatMoney, money } from '@treasure/core';
	import { areaPath, compact, linePath, nearest, niceTicks, scale, type Point } from './chart.ts';
	import { useUi } from './context.ts';

	interface Datum {
		/** ISO date, YYYY-MM-DD. */
		date: string;
		/** Minor units. */
		value: number;
	}

	interface Props {
		/** What the chart shows, read by screen readers. */
		label: string;
		points: readonly Datum[];
		currency: string;
		/** A second line drawn dashed on top, e.g. a what-if. */
		compare?: readonly Datum[];
		compareLabel?: string;
		/** A dashed horizontal guide, e.g. the balance floor. Minor units. */
		guide?: number | null;
		guideLabel?: string;
		/** Small ticks on the baseline, e.g. upcoming bills. */
		markers?: readonly { date: string; label: string }[];
		height?: number;
	}

	let {
		label,
		points,
		currency,
		compare = [],
		compareLabel = '',
		guide = null,
		guideLabel = '',
		markers = [],
		height = 240
	}: Props = $props();

	const ui = useUi();
	let width = $state(640);
	let hover = $state<number | null>(null);

	const pad = { top: 16, right: 12, bottom: 28, left: 52 };
	const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

	const geometry = $derived.by(() => {
		const all = [...points, ...compare];
		if (all.length === 0) return null;
		const values = all.map((p) => p.value / 100);
		// Fit the data; show the guide and zero only when the line comes near them.
		const low = Math.min(...values);
		const high = Math.max(...values);
		const near = (value: number) => value >= low - (high - low) * 0.5;
		if (guide !== null && near(guide / 100)) values.push(guide / 100);
		if (near(0)) values.push(0);
		const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
		const days = all.map((p) => day(p.date));
		const x = scale(
			[Math.min(...days), Math.max(...days)],
			[pad.left, Math.max(pad.left + 10, width - pad.right)]
		);
		const y = scale([ticks[0]!, ticks[ticks.length - 1]!], [height - pad.bottom, pad.top]);
		const toPoints = (list: readonly Datum[]): Point[] =>
			list.map((p) => ({ x: x(day(p.date)), y: y(p.value / 100) }));
		return { x, y, ticks, main: toPoints(points), other: toPoints(compare) };
	});

	const curve = $derived(ui.charts.curve);
	const format = (minor: number) =>
		formatMoney(money(Math.round(minor), currency), { locale: ui.locale });
	const dateText = (iso: string) =>
		new Intl.DateTimeFormat(ui.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			new Date(`${iso}T00:00:00Z`)
		);

	/** Four date labels spread along the bottom. */
	const dateTicks = $derived.by(() => {
		if (points.length < 2) return points.map((_, i) => i);
		const steps = Math.min(4, points.length - 1);
		return Array.from({ length: steps + 1 }, (_, i) =>
			Math.round((i / steps) * (points.length - 1))
		);
	});

	function move(event: PointerEvent) {
		if (!geometry || geometry.main.length === 0) return;
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const scaleX = width / box.width;
		hover = nearest(geometry.main, (event.clientX - box.left) * scaleX);
	}

	function key(event: KeyboardEvent) {
		if (points.length === 0) return;
		if (event.key === 'ArrowRight') hover = Math.min(points.length - 1, (hover ?? -1) + 1);
		else if (event.key === 'ArrowLeft') hover = Math.max(0, (hover ?? points.length) - 1);
		else if (event.key === 'Escape') hover = null;
		else return;
		event.preventDefault();
	}

	const lowest = $derived(
		points.length === 0
			? null
			: points.reduce((low, p) => (p.value < low.value ? p : low), points[0]!)
	);
	const summary = $derived(
		points.length === 0
			? label
			: `${label}: ${dateText(points[0]!.date)} ${format(points[0]!.value)}, ${dateText(points[points.length - 1]!.date)} ${format(points[points.length - 1]!.value)}${lowest ? `, lowest ${format(lowest.value)} on ${dateText(lowest.date)}` : ''}.`
	);
</script>

<figure class="chart" bind:clientWidth={width} data-tooltip={ui.charts.tooltip}>
	{#if geometry}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<svg
			viewBox="0 0 {width} {height}"
			{height}
			role="img"
			aria-label={summary}
			tabindex="0"
			onpointermove={move}
			onpointerleave={() => (hover = null)}
			onkeydown={key}
			onblur={() => (hover = null)}
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
			{#each dateTicks as index (index)}
				{@const p = geometry.main[index]}
				{#if p}
					<text
						class="axis"
						x={p.x}
						y={height - 8}
						text-anchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
						>{dateText(points[index]!.date)}</text
					>
				{/if}
			{/each}

			<path
				class="area"
				d={areaPath(geometry.main, curve, geometry.y(Math.max(geometry.ticks[0]!, 0)))}
			/>
			{#if guide !== null && guide / 100 >= geometry.ticks[0]! && guide / 100 <= geometry.ticks.at(-1)!}
				<line
					class="guide"
					x1={pad.left}
					x2={width - pad.right}
					y1={geometry.y(guide / 100)}
					y2={geometry.y(guide / 100)}
				/>
				{#if guideLabel}
					<text
						class="guide-label"
						x={width - pad.right}
						y={geometry.y(guide / 100) - 6}
						text-anchor="end">{guideLabel}</text
					>
				{/if}
			{/if}
			<path class="line" d={linePath(geometry.main, curve)} />
			{#if geometry.other.length > 0}
				<path class="line compare" d={linePath(geometry.other, curve)} />
			{/if}
			{#each markers as marker, i (i)}
				{@const mx = geometry.x(day(marker.date))}
				<rect class="marker" x={mx - 1.5} y={height - pad.bottom - 7} width="3" height="7"
					><title>{marker.label}</title></rect
				>
			{/each}
			{#if ui.charts.points}
				{#each geometry.main as p, i (i)}<circle class="dot" cx={p.x} cy={p.y} r="2.5" />{/each}
			{/if}
			{#if lowest && hover === null}
				{@const i = points.indexOf(lowest)}
				{@const p = geometry.main[i]}
				{#if p}<rect
						class="low"
						x={p.x - 5}
						y={p.y - 5}
						width="10"
						height="10"
						transform="rotate(45 {p.x} {p.y})"
					/>{/if}
			{/if}
			{#if hover !== null && geometry.main[hover]}
				{@const p = geometry.main[hover]!}
				<line class="cross" x1={p.x} x2={p.x} y1={pad.top} y2={height - pad.bottom} />
				<circle class="focus" cx={p.x} cy={p.y} r="5" />
			{/if}
		</svg>
		{#if hover !== null && geometry.main[hover] && points[hover]}
			{@const p = geometry.main[hover]!}
			{@const other = compare.find((c) => c.date === points[hover!]!.date)}
			<div
				class="tip"
				style="--x: {(p.x / width) * 100}%; --y: {p.y}px"
				class:flip={p.x > width * 0.6}
			>
				<span class="tip-date">{dateText(points[hover]!.date)}</span>
				<strong>{format(points[hover]!.value)}</strong>
				{#if other}<span class="tip-other">{compareLabel} {format(other.value)}</span>{/if}
			</div>
		{/if}
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
		touch-action: pan-y;
	}
	svg:focus-visible {
		outline: 2px solid var(--tr-color-focus-ring);
		outline-offset: 4px;
	}
	.grid {
		stroke: var(--tr-color-border);
		stroke-width: 1;
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
	.area {
		fill: var(--tr-color-accent);
		opacity: var(--tr-chart-area-opacity);
	}
	.line {
		fill: none;
		stroke: var(--tr-color-accent);
		stroke-width: calc(var(--tr-chart-line) + 1px);
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.line.compare {
		stroke: var(--tr-color-secondary);
		stroke-dasharray: 6 5;
	}
	.guide {
		stroke: var(--tr-color-warning);
		stroke-width: 1.5;
		stroke-dasharray: 3 4;
	}
	.guide-label {
		fill: var(--tr-color-warning);
		font-size: 11px;
	}
	.marker {
		fill: var(--tr-color-text-muted);
	}
	.dot {
		fill: var(--tr-color-accent);
	}
	.low {
		fill: var(--tr-color-paper);
		stroke: var(--tr-color-accent);
		stroke-width: 2;
	}
	.cross {
		stroke: var(--tr-color-paper);
		stroke-width: 1;
	}
	.focus {
		fill: var(--tr-color-paper);
		stroke: var(--tr-color-accent);
		stroke-width: 3;
	}
	.tip {
		position: absolute;
		top: max(calc(var(--y) - 0.5rem), 3.75rem);
		left: var(--x);
		display: grid;
		gap: 2px;
		padding: var(--tr-space-xs) var(--tr-space-sm);
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		box-shadow: 4px 4px 0 var(--tr-color-accent);
		transform: translate(12px, -100%) skewX(var(--tr-skew));
		pointer-events: none;
		white-space: nowrap;
		font-size: var(--tr-text-sm);
	}
	.tip.flip {
		transform: translate(calc(-100% - 12px), -100%) skewX(var(--tr-skew));
	}
	[data-tooltip='minimal'] .tip {
		background: transparent;
		color: var(--tr-color-text);
		box-shadow: none;
	}
	.tip strong {
		font-family: var(--tr-font-numbers);
		font-size: var(--tr-text-md);
		font-variant-numeric: var(--tr-numeric);
	}
	.tip-date,
	.tip-other {
		font-size: var(--tr-text-xs);
	}
</style>
