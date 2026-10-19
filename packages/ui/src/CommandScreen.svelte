<script lang="ts">
	/**
	 * The Persona 5 command menu, full screen. The page behind freezes and turns red, a star
	 * pattern slides in, the commands drop in as cut-out words, and a red-and-cyan cursor that
	 * never quite sits still jumps between them. Up/Down (or pointing) moves it, Enter or a
	 * click goes there, Esc closes. The big heading and the line under it describe the
	 * highlighted command; the corner number counts it.
	 */
	import { onMount, tick } from 'svelte';
	import Cutout from './Cutout.svelte';
	import StarField from './StarField.svelte';
	import type { CommandWords, MenuArt, NavItem } from './types.ts';

	interface Props {
		items: readonly NavItem[];
		words: CommandWords;
		wallet?: { label: string; text: string } | null;
		art?: MenuArt | null;
		onclose: () => void;
	}

	let { items, words, wallet = null, art = null, onclose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let selected = $state(
		Math.max(
			0,
			items.findIndex((item) => item.active)
		)
	);
	let list = $state<HTMLUListElement | null>(null);
	let stack = $state<HTMLDivElement | null>(null);
	let cursor = $state({ x: 0, y: 0, w: 0, h: 0, lx: 0, r: 0, ready: false });
	let red = $state<SVGPolygonElement | null>(null);
	let cyan = $state<SVGPolygonElement | null>(null);

	const current = $derived(items[selected]);
	const number = $derived(String(selected + 1).padStart(2, '0'));
	const artSrc = $derived(
		(current?.key ? art?.commands[current.key] : undefined) ?? art?.default ?? null
	);

	/** Lean and stagger of each line, hand-placed like the game's list. */
	const lean = [
		{ x: 1.2, r: -3 },
		{ x: 2.2, r: 1 },
		{ x: 1.6, r: -2 },
		{ x: 0.4, r: 2 },
		{ x: 1.8, r: -1 },
		{ x: 0.8, r: -4 },
		{ x: 1.4, r: 2 },
		{ x: 2.4, r: -2 },
		{ x: 0.6, r: 1 }
	];
	const place = (index: number) => {
		const spot = lean[index % lean.length]!;
		return `--x:${spot.x}em;--r:${spot.r}deg;--n:${index}`;
	};

	/** Puts the cursor behind the highlighted word. */
	function measure() {
		// The link's own box: the word inside grows when highlighted, the link doesn't.
		const link = list?.querySelectorAll<HTMLElement>('a')[selected];
		if (!stack || !link) return;
		// Layout positions, not on-screen boxes: the lines are still flying in when this runs.
		const line = link.parentElement as HTMLElement;
		const spot = lean[selected % lean.length]!;
		cursor = {
			x: line.offsetLeft + link.offsetLeft,
			y: line.offsetTop + link.offsetTop,
			w: link.offsetWidth,
			h: link.offsetHeight,
			lx: spot.x,
			r: spot.r,
			ready: true
		};
	}

	$effect(() => {
		void selected;
		tick().then(measure);
	});

	function focusItem(index: number) {
		selected = (index + items.length) % items.length;
		list?.querySelectorAll<HTMLAnchorElement>('a')[selected]?.focus();
	}

	function key(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') focusItem(selected + 1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') focusItem(selected - 1);
		else if (event.key === 'Home') focusItem(0);
		else if (event.key === 'End') focusItem(items.length - 1);
		else if (event.key === 'Escape') onclose();
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	/*
	 * The cursor's two shards (red under, cyan on top). Their corners drift to a new random
	 * spot a few times a second, so the highlight always looks alive, like in the game.
	 */
	const RED = [
		[-11, 49],
		[215, 78],
		[209, 42],
		[3, 13]
	];
	const CYAN = [
		[20, 63],
		[205, 51],
		[219, 3],
		[12, 28]
	];

	onMount(() => {
		// The first focus goes to the highlighted command, so the keyboard works at once.
		focusItem(selected);
		const resize = () => measure();
		window.addEventListener('resize', resize);
		const html = document.documentElement;
		const previous = html.style.overflow;
		html.style.overflow = 'hidden';

		const still =
			html.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
		const draw = (polygon: SVGPolygonElement | null, points: number[][]) =>
			polygon?.setAttribute('points', points.map((p) => p.join(',')).join(' '));
		let frame = 0;
		if (still) {
			draw(red, RED);
			draw(cyan, CYAN);
		} else {
			const jitter = (base: number[][], size: number) =>
				base.map(([x, y]) => [
					x! + (Math.random() * 2 - 1) * size,
					y! + (Math.random() * 2 - 1) * size
				]);
			let from = [RED, CYAN];
			let to = [jitter(RED, 7), jitter(CYAN, 7)];
			let start = performance.now();
			const PERIOD = 260;
			const loop = (now: number) => {
				let t = (now - start) / PERIOD;
				if (t >= 1) {
					from = to;
					to = [jitter(RED, 7), jitter(CYAN, 7)];
					start = now;
					t = 0;
				}
				const mix = (a: number[][], b: number[][]) =>
					a.map((p, i) => [p[0]! + (b[i]![0]! - p[0]!) * t, p[1]! + (b[i]![1]! - p[1]!) * t]);
				draw(red, mix(from[0]!, to[0]!));
				draw(cyan, mix(from[1]!, to[1]!));
				frame = requestAnimationFrame(loop);
			};
			frame = requestAnimationFrame(loop);
		}

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
			html.style.overflow = previous;
		};
	});
</script>

<div
	class="screen"
	role="dialog"
	aria-modal="true"
	aria-label={words.heading}
	tabindex="-1"
	onkeydown={key}
>
	<div class="tint" aria-hidden="true"></div>
	<div class="field" aria-hidden="true"><StarField /></div>

	{#if artSrc}
		{#key artSrc}
			<img class="art" src={artSrc} alt="" />
		{/key}
	{/if}

	<div class="plate" aria-hidden="true">
		<span class="plate-card">
			<span class="plate-title"><Cutout text={words.plate.title} salt={3} /></span>
			<span class="plate-hint">{words.plate.hint}</span>
		</span>
		<span class="number">{number}</span>
	</div>

	<nav class="commands" aria-label={words.heading}>
		<div class="stack" bind:this={stack}>
			<span
				class="cursor"
				class:ready={cursor.ready}
				style="--cx:{cursor.x}px;--cy:{cursor.y}px;--cw:{cursor.w}px;--ch:{cursor.h}px;--lx:{cursor.lx}em;--lr:{cursor.r}deg"
				aria-hidden="true"
			>
				<svg viewBox="-20 -5 250 90" preserveAspectRatio="none">
					<polygon class="shard-red" bind:this={red} />
					<polygon class="shard-cyan" bind:this={cyan} />
				</svg>
			</span>
			<ul bind:this={list}>
				{#each items as item, index (item.href)}
					<li style={place(index)} class:on={index === selected}>
						<a
							href={item.href}
							aria-current={item.active ? 'page' : undefined}
							aria-label={item.label}
							aria-describedby={index === selected ? 'command-hint' : undefined}
							onpointerenter={() => (selected = index)}
							onfocus={() => (selected = index)}
							onclick={() => onclose()}
						>
							<span class="word"
								><Cutout text={item.label} salt={index} flip={index === selected} /></span
							>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</nav>

	<div class="caption">
		<span class="heading"><Cutout text={words.heading} salt={9} /></span>
		{#key selected}
			<p class="hint" id="command-hint">{current?.hint ?? current?.label}</p>
		{/key}
	</div>

	{#if wallet}
		<p class="wallet" aria-label="{wallet.label}: {wallet.text}">
			<span aria-hidden="true">{wallet.text}</span>
		</p>
	{/if}

	<div class="keys">
		<span class="key-hint" aria-hidden="true"><kbd>↑↓</kbd>{words.move}</span>
		<span class="key-hint" aria-hidden="true"><kbd>Enter</kbd>{words.confirm}</span>
		<button type="button" class="key-hint close" onclick={onclose}
			><kbd>Esc</kbd>{words.close}</button
		>
	</div>
</div>

<style>
	.screen {
		position: fixed;
		z-index: 40;
		inset: 0;
		overflow: hidden;
		color: var(--tr-color-paper);
		outline: none;
	}

	/* The page behind, frozen and soaked in red. */
	.tint {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--tr-color-accent) 72%, transparent);
		backdrop-filter: grayscale(1) contrast(1.4) brightness(0.55);
		animation: fade var(--tr-duration-fast) linear both;
	}

	/* The star pattern, torn along its left edge. */
	.field {
		position: absolute;
		inset: 0 0 0 34%;
		clip-path: polygon(16% 0, 100% 0, 100% 100%, 4% 100%, 12% 64%, 0 58%, 9% 30%);
		animation: slide-in var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}

	.art {
		position: absolute;
		bottom: 0;
		left: 22%;
		height: 94%;
		max-width: 60%;
		object-fit: contain;
		object-position: bottom;
		pointer-events: none;
		animation: pose var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}

	/* ── "Menu: Main" plate and the big number ─────────────────────────────── */
	.plate {
		position: absolute;
		top: 4%;
		right: 4%;
		display: grid;
		justify-items: end;
		gap: 0.2rem;
		transform: rotate(-6deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 80ms both;
	}
	.plate-card {
		display: grid;
		justify-items: center;
		padding: 0.35rem 0.8rem 0.4rem;
		background: var(--tr-color-ink);
		border: 3px solid var(--tr-color-paper);
		box-shadow: 6px 6px 0 var(--tr-color-ink);
	}
	.plate-title {
		font-size: 1.7rem;
	}
	.plate-hint {
		font-family: var(--tr-font-heading);
		font-size: 0.8rem;
		letter-spacing: 0.06em;
	}
	.number {
		font-family: var(--tr-font-ransom-3, var(--tr-font-heading));
		font-size: 5.5rem;
		line-height: 0.9;
		color: var(--tr-color-ink);
		-webkit-text-stroke: 0.06em var(--tr-color-paper);
		paint-order: stroke fill;
		transform: rotate(4deg);
	}

	/* ── The commands ──────────────────────────────────────────────────────── */
	.commands {
		position: absolute;
		top: 13%;
		left: max(1.5rem, 26vw);
		font-size: clamp(1.9rem, 5.6vh, 3.4rem);
	}
	.stack {
		position: relative;
	}
	ul {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 0.12em;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		z-index: 1;
		transform: translateX(var(--x)) rotate(var(--r));
		transform-origin: left center;
		animation: deal var(--tr-duration-normal) var(--tr-ease-emphasized) both;
		animation-delay: calc(60ms + var(--n) * 35ms);
	}
	a {
		display: inline-block;
		color: inherit;
		text-decoration: none;
		outline: none;
	}
	.word {
		display: inline-block;
		filter: drop-shadow(0.06em 0.06em 0 var(--tr-color-ink));
		transform-origin: left center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	li.on .word {
		transform: scale(1.28) translateX(0.15em) rotate(-3deg);
		filter: none;
	}
	/* Focus follows the cursor, so the red and cyan shards are the focus mark. */

	/* The red and cyan shards behind the highlighted word. */
	.cursor {
		position: absolute;
		z-index: 0;
		top: 0;
		left: 0;
		width: calc(var(--cw) * 1.45);
		height: calc(var(--ch) * 1.7);
		opacity: 0;
		/* Same lean as the line it sits behind. */
		transform: translate(calc(var(--cx) - var(--cw) * 0.12), calc(var(--cy) - var(--ch) * 0.42))
			translateX(var(--lx)) rotate(var(--lr));
		transform-origin: 8.3% 47%;
		transition:
			transform var(--tr-duration-normal) var(--tr-ease-emphasized),
			width var(--tr-duration-normal) var(--tr-ease-emphasized),
			height var(--tr-duration-normal) var(--tr-ease-emphasized);
		pointer-events: none;
	}
	.cursor.ready {
		opacity: 1;
	}
	.cursor svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.shard-red {
		fill: var(--tr-color-accent);
	}
	.shard-cyan {
		fill: var(--tr-color-cursor);
	}

	/* ── "COMMAND" and the line under it ──────────────────────────────────── */
	.caption {
		position: absolute;
		right: 6%;
		bottom: 9%;
		display: grid;
		justify-items: end;
		gap: 0.4rem;
		transform: rotate(-4deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 120ms both;
	}
	.heading {
		font-size: clamp(3rem, 9vh, 6rem);
		filter: drop-shadow(0.05em 0.05em 0 var(--tr-color-ink));
	}
	.hint {
		margin: 0;
		padding: 0.2rem 0.8rem;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-family: var(--tr-font-heading);
		font-size: 1.05rem;
		transform: skewX(var(--tr-skew));
		animation: hint var(--tr-duration-fast) var(--tr-ease-standard) both;
	}

	/* ── The money counter ─────────────────────────────────────────────────── */
	.wallet {
		position: absolute;
		left: 4%;
		bottom: 9%;
		margin: 0;
		font-family: var(--tr-font-heading);
		font-size: clamp(2.2rem, 6vh, 3.4rem);
		font-style: italic;
		line-height: 1;
		color: var(--tr-color-paper);
		-webkit-text-stroke: 0.12em var(--tr-color-ink);
		paint-order: stroke fill;
		transform: rotate(-8deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 160ms both;
	}

	/* ── Button hints ──────────────────────────────────────────────────────── */
	.keys {
		position: absolute;
		right: 2%;
		bottom: 2.5%;
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.4rem 1rem;
	}
	.key-hint {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--tr-color-paper);
		font: inherit;
		font-family: var(--tr-font-heading);
		font-size: 0.95rem;
		font-style: italic;
		-webkit-text-stroke: 0.15em var(--tr-color-ink);
		paint-order: stroke fill;
	}
	.close {
		cursor: pointer;
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.7rem;
		height: 1.7rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-family: var(--tr-font-body);
		font-size: 0.72rem;
		font-style: normal;
		font-weight: var(--tr-weight-bold);
		-webkit-text-stroke: 0;
		box-shadow: 0 0 0 2px var(--tr-color-ink);
	}

	/* ── Phones ────────────────────────────────────────────────────────────── */
	@media (max-width: 720px) {
		.field {
			inset: 0 0 0 30%;
		}
		.commands {
			top: 15%;
			left: 1rem;
			font-size: min(1.8rem, 4vh);
		}
		li {
			transform: translateX(calc(var(--x) * 0.4)) rotate(var(--r));
		}
		.cursor {
			transform: translate(calc(var(--cx) - var(--cw) * 0.12), calc(var(--cy) - var(--ch) * 0.42))
				translateX(calc(var(--lx) * 0.4)) rotate(var(--lr));
		}
		.number {
			display: none;
		}
		.plate {
			top: 2%;
			right: 3%;
		}
		.plate-title {
			font-size: 1.2rem;
		}
		.number {
			font-size: 3.5rem;
		}
		.caption {
			right: 4%;
			bottom: 8%;
		}
		.heading {
			font-size: 2.3rem;
		}
		.wallet {
			top: 3%;
			bottom: auto;
			left: 4%;
			font-size: 1.9rem;
		}
		.keys .key-hint:not(.close) {
			display: none;
		}
		.close {
			font-size: 1.15rem;
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes slide-in {
		from {
			transform: translateX(60%);
		}
	}
	@keyframes deal {
		from {
			opacity: 0;
			transform: translateX(-70vw) rotate(-24deg);
		}
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-40%) rotate(-14deg) scale(1.3);
		}
	}
	@keyframes hint {
		from {
			opacity: 0;
			transform: skewX(var(--tr-skew)) translateX(1rem);
		}
	}
	@keyframes pose {
		from {
			opacity: 0;
			transform: translateX(-4%) scale(1.04);
		}
	}
</style>
