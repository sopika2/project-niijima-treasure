<script lang="ts">
	/**
	 * The Persona 5 command menu, full screen, laid out after the game's own screen:
	 * the world behind blurred into dark red, op-art stars, a red slash, the commands stacked
	 * tight and right-aligned as white sticker letters, the highlighted one bigger on a red
	 * and cyan shard that never sits still. Around it: flavour strips and the "Menu: Main"
	 * plate with a huge number in the top corner, the giant heading with a line describing
	 * the command, the money counter, the party (your accounts) and the button hints.
	 * Up/Down (or pointing) moves, Enter or a click goes there, Esc closes.
	 */
	import { onMount, tick } from 'svelte';
	import Cutout from './Cutout.svelte';
	import StarField from './StarField.svelte';
	import type { CommandWords, MenuArt, NavItem, PartyMember } from './types.ts';

	interface Props {
		items: readonly NavItem[];
		words: CommandWords;
		wallet?: { label: string; text: string } | null;
		party?: readonly PartyMember[];
		art?: MenuArt | null;
		onclose: () => void;
	}

	let { items, words, wallet = null, party = [], art = null, onclose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let selected = $state(
		Math.max(
			0,
			items.findIndex((item) => item.active)
		)
	);
	let list = $state<HTMLUListElement | null>(null);
	let cursor = $state({ x: 0, y: 0, w: 0, h: 0, ready: false });
	let red = $state<SVGPolygonElement | null>(null);
	let cyan = $state<SVGPolygonElement | null>(null);

	const current = $derived(items[selected]);
	const number = $derived(String(selected + 1).padStart(2, '0'));
	const artSrc = $derived(
		(current?.key ? art?.commands[current.key] : undefined) ?? art?.default ?? null
	);

	/** Small hand-placed nudges so the right edge of the stack isn't ruler-straight. */
	const nudge = [0.2, -0.4, 0, -0.7, -0.3, 0.1, -0.5, -0.1, -0.6];
	const tilt = [-2, 1, -1, 2, 0, -2, 1, -1, 2];
	const place = (index: number) =>
		`--x:${nudge[index % nudge.length]}em;--r:${tilt[index % tilt.length]}deg;--n:${index}`;

	/** Puts the cursor behind the highlighted line, from layout positions (not mid-animation boxes). */
	function measure() {
		const link = list?.querySelectorAll<HTMLElement>('a')[selected];
		if (!link) return;
		const line = link.parentElement as HTMLElement;
		cursor = {
			x: line.offsetLeft + link.offsetLeft,
			y: line.offsetTop + link.offsetTop,
			w: link.offsetWidth,
			h: link.offsetHeight,
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
	 * The cursor's two shards: a red slab under the word reaching out to the right, and a
	 * cyan sliver along its top edge. Their corners drift a few times a second.
	 */
	const RED = [
		[8, 30],
		[100, 6],
		[112, 88],
		[0, 100]
	];
	const CYAN = [
		[0, 12],
		[96, 0],
		[92, 26],
		[4, 36]
	];

	onMount(() => {
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
			let to = [jitter(RED, 4), jitter(CYAN, 3)];
			let start = performance.now();
			const PERIOD = 240;
			const loop = (now: number) => {
				let t = (now - start) / PERIOD;
				if (t >= 1) {
					from = to;
					to = [jitter(RED, 4), jitter(CYAN, 3)];
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
	<div class="room" aria-hidden="true"></div>
	<div class="field" aria-hidden="true"><StarField /></div>
	{#if artSrc}
		{#key artSrc}
			<img class="art" src={artSrc} alt="" />
		{/key}
	{:else}
		<!-- Stand-in for the character until menu_art is set: a two-tone torn silhouette. -->
		<div class="figure" aria-hidden="true"><span class="dots"></span></div>
	{/if}
	<div class="slash" aria-hidden="true"></div>

	<div class="flavor" aria-hidden="true">
		<span class="strip one"><Cutout text={words.flavor[0]} salt={11} /></span>
		<span class="strip two"><Cutout text={words.flavor[1]} salt={12} /></span>
	</div>

	<div class="plate" aria-hidden="true">
		<span class="plate-title"><Cutout text={words.plate.title} salt={3} /></span>
		<span class="plate-hint"><Cutout text={words.plate.hint} salt={4} /></span>
	</div>
	<span class="number" aria-hidden="true">{number}</span>

	<nav class="commands" aria-label={words.heading}>
		<span
			class="cursor"
			class:ready={cursor.ready}
			style="--cx:{cursor.x}px;--cy:{cursor.y}px;--cw:{cursor.w}px;--ch:{cursor.h}px"
			aria-hidden="true"
		>
			<svg viewBox="0 0 112 100" preserveAspectRatio="none">
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
						<span class="word"><Cutout text={item.label} salt={index} /></span>
					</a>
				</li>
			{/each}
		</ul>
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

	{#if party.length > 0}
		<ul class="party" aria-hidden="true">
			{#each party.slice(0, 4) as member, i (i)}
				<li style="--share:{Math.max(0.04, Math.min(1, member.share))};--n:{i}">
					<span class="member"><Cutout text={member.name.slice(0, 2)} salt={20 + i} /></span>
					<span class="bar"><span></span></span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="keys">
		<span class="key-hint" aria-hidden="true"><kbd>↑↓</kbd>{words.move}</span>
		<span class="key-hint" aria-hidden="true"><kbd>⏎</kbd>{words.confirm}</span>
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

	/* The world behind, blurred and drowned in dark red, like the paused game. */
	.room {
		position: absolute;
		inset: 0;
		background: color-mix(
			in srgb,
			color-mix(in srgb, var(--tr-color-accent) 68%, var(--tr-color-ink)) 92%,
			transparent
		);
		backdrop-filter: blur(5px) grayscale(1) brightness(0.5);
		animation: fade var(--tr-duration-fast) linear both;
	}

	/* Op-art stars from a third of the way across, torn along the left edge. */
	.field {
		position: absolute;
		inset: 0 0 0 30vw;
		clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%, 10% 78%, 3% 70%, 14% 44%, 8% 30%);
		animation: slide-in var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}

	/* The big red slash behind the list. */
	.slash {
		position: absolute;
		inset: 0;
		background: var(--tr-color-accent);
		clip-path: polygon(52vw 17vh, 72vw 13vh, 58vw 47vh, 70vw 58vh, 47vw 72vh, 53vw 52vh, 46vw 44vh);
		animation: slash var(--tr-duration-normal) var(--tr-ease-emphasized) 60ms both;
	}

	/* Where the character goes: white paper torn into a tall shape, its right side in black
	   (the game splits its figures the same way), with a patch of halftone dots. */
	.figure {
		position: absolute;
		top: 6vh;
		left: 27vw;
		width: 42vw;
		height: 94vh;
		background: linear-gradient(118deg, var(--tr-color-paper) 0 47%, var(--tr-color-ink) 47% 100%);
		clip-path: polygon(
			18% 14%,
			24% 0,
			31% 12%,
			40% 2%,
			46% 14%,
			57% 6%,
			60% 20%,
			74% 12%,
			78% 30%,
			92% 36%,
			86% 52%,
			100% 70%,
			96% 100%,
			8% 100%,
			0 76%,
			10% 58%,
			4% 40%,
			14% 30%
		);
		filter: drop-shadow(0 0 0 var(--tr-color-ink));
		animation: pose var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	.dots {
		position: absolute;
		top: 8%;
		left: 52%;
		width: 34%;
		height: 30%;
		background: radial-gradient(circle, var(--tr-color-paper) 1.8px, transparent 2.1px) 0 0 / 9px
			9px;
		clip-path: polygon(10% 0, 100% 14%, 86% 100%, 0 80%);
	}
	.art {
		position: absolute;
		bottom: 0;
		left: 30vw;
		height: 100vh;
		max-width: 55vw;
		object-fit: contain;
		object-position: bottom;
		pointer-events: none;
		animation: pose var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}

	/* ── Top corner: flavour strips, "Menu: Main", the number ──────────────── */
	.strip {
		position: absolute;
		padding: 0.12em 0.4em 0.18em;
		background: var(--tr-color-ink);
		border: 3px solid var(--tr-color-paper);
		font-size: 4.6vh;
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	.strip.one {
		top: 1.5vh;
		left: 66vw;
		transform: rotate(-8deg);
		animation-delay: 60ms;
	}
	.strip.two {
		top: 13vh;
		left: 73vw;
		transform: rotate(-5deg);
		animation-delay: 100ms;
	}
	.plate {
		position: absolute;
		top: 27vh;
		left: 79vw;
		display: grid;
		justify-items: center;
		padding: 0.5vh 1.2vh 0.8vh;
		background: var(--tr-color-ink);
		border: 3px solid var(--tr-color-paper);
		box-shadow: 0 0 0 3px var(--tr-color-ink);
		transform: rotate(-4deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 140ms both;
	}
	.plate-title {
		font-size: 4.8vh;
	}
	.plate-hint {
		font-size: 2vh;
	}
	.number {
		position: absolute;
		top: 37vh;
		left: 76vw;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-ransom-2, var(--tr-font-heading));
		font-size: 25vh;
		line-height: 1;
		-webkit-text-stroke: 0.06em var(--tr-color-ink);
		paint-order: stroke fill;
		filter: drop-shadow(0.04em 0.05em 0 var(--tr-color-ink));
		transform: rotate(-7deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 180ms both;
	}

	/* ── The commands: a tight, right-aligned stack ────────────────────────── */
	.commands {
		position: absolute;
		top: 25vh;
		right: 44vw;
		font-size: max(1.4rem, 4.7vh);
	}
	ul {
		position: relative;
		display: grid;
		justify-items: end;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.commands li {
		position: relative;
		z-index: 1;
		line-height: 1.12;
		transform: translateX(var(--x)) rotate(var(--r));
		transform-origin: right center;
		animation: deal var(--tr-duration-normal) var(--tr-ease-emphasized) both;
		animation-delay: calc(40ms + var(--n) * 30ms);
	}
	a {
		display: inline-block;
		color: inherit;
		text-decoration: none;
		outline: none;
	}
	.word {
		display: inline-block;
		transform-origin: right center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	li.on {
		z-index: 2;
	}
	li.on .word {
		transform: scale(1.36) translateX(0.12em) rotate(-2deg);
	}

	.cursor {
		position: absolute;
		z-index: 0;
		top: 0;
		left: 0;
		width: calc(var(--cw) * 1.62);
		height: calc(var(--ch) * 1.5);
		opacity: 0;
		transform: translate(calc(var(--cx) - var(--cw) * 0.46), calc(var(--cy) - var(--ch) * 0.22))
			rotate(-3deg);
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
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.shard-red {
		fill: var(--tr-color-accent);
		stroke: var(--tr-color-ink);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.shard-cyan {
		fill: var(--tr-color-cursor);
	}

	/* ── The heading and the line under it ────────────────────────────────── */
	.caption {
		position: absolute;
		top: 71vh;
		left: 42vw;
		display: grid;
		justify-items: center;
		transform: rotate(-2deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 120ms both;
	}
	.heading {
		font-size: 12vh;
		line-height: 1;
	}
	.hint {
		margin: -0.6vh 1vw 0 0;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-heading);
		font-size: 2.4vh;
		font-style: italic;
		-webkit-text-stroke: 0.22em var(--tr-color-ink);
		paint-order: stroke fill;
		animation: hint var(--tr-duration-fast) var(--tr-ease-standard) both;
	}

	/* ── The money counter ─────────────────────────────────────────────────── */
	.wallet {
		position: absolute;
		top: 81vh;
		left: 24vw;
		margin: 0;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-heading);
		font-size: 5.4vh;
		font-style: italic;
		line-height: 1;
		-webkit-text-stroke: 0.16em var(--tr-color-ink);
		paint-order: stroke fill;
		transform: rotate(-4deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 160ms both;
	}

	/* ── The party: your accounts with their share of the total ───────────── */
	.party {
		position: absolute;
		right: 2vw;
		bottom: 8vh;
		display: flex;
		gap: 0.8vw;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.party li {
		display: grid;
		justify-items: start;
		gap: 0.6vh;
		width: 4.6vw;
		min-width: 4rem;
		padding: 0.8vh 0.6vw 1vh;
		background: var(--tr-color-ink);
		border: 2px solid var(--tr-color-paper);
		transform: rotate(-6deg) skewX(var(--tr-skew));
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) both;
		animation-delay: calc(200ms + var(--n) * 40ms);
	}
	.member {
		font-size: 3.4vh;
	}
	.bar {
		width: 100%;
		height: 0.8vh;
		min-height: 5px;
		background: var(--tr-color-surface-raised);
	}
	.bar span {
		display: block;
		width: calc(var(--share) * 100%);
		height: 100%;
		background: var(--tr-color-cursor);
	}

	/* ── Button hints ──────────────────────────────────────────────────────── */
	.keys {
		position: absolute;
		right: 2vw;
		bottom: 2vh;
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.4rem 1.1rem;
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
		font-size: max(0.95rem, 2.4vh);
		font-style: italic;
		-webkit-text-stroke: 0.2em var(--tr-color-ink);
		paint-order: stroke fill;
	}
	.close {
		cursor: pointer;
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.8em;
		height: 1.8em;
		padding: 0 0.35em;
		border-radius: 999px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-family: var(--tr-font-body);
		font-size: 0.7em;
		font-style: normal;
		font-weight: var(--tr-weight-bold);
		-webkit-text-stroke: 0;
		box-shadow: 0 0 0 2px var(--tr-color-ink);
	}

	/* ── Tall screens (phones) ─────────────────────────────────────────────── */
	@media (max-aspect-ratio: 4/5) {
		.field {
			inset: 0 0 0 38vw;
		}
		.figure {
			left: 6vw;
			width: 80vw;
			top: 12vh;
			height: 70vh;
		}
		.slash {
			clip-path: polygon(
				55vw 20vh,
				90vw 16vh,
				66vw 45vh,
				86vw 54vh,
				50vw 70vh,
				60vw 50vh,
				48vw 42vh
			);
		}
		.commands {
			top: 22vh;
			right: 10vw;
			font-size: min(3.4vh, 7.5vw);
		}
		li.on .word {
			transform: scale(1.18) translateX(0.08em) rotate(-2deg);
		}
		.flavor,
		.number,
		.party,
		.keys .key-hint:not(.close) {
			display: none;
		}
		.plate {
			top: 9vh;
			left: auto;
			right: 4vw;
		}
		.plate-title {
			font-size: 3.4vh;
		}
		.plate-hint {
			font-size: 1.5vh;
		}
		.caption {
			top: auto;
			bottom: 10vh;
			left: auto;
			right: 4vw;
		}
		.heading {
			font-size: min(7.5vh, 15vw);
		}
		.hint {
			font-size: 2.2vh;
		}
		.wallet {
			top: 2.5vh;
			left: 4vw;
			font-size: min(4.2vh, 8vw);
		}
		.close {
			font-size: 1.2rem;
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes slide-in {
		from {
			transform: translateX(50%);
		}
	}
	@keyframes slash {
		from {
			opacity: 0;
			transform: scale(1.4) rotate(-10deg);
		}
	}
	@keyframes deal {
		from {
			opacity: 0;
			transform: translateX(-60vw) rotate(-20deg);
		}
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-30%) rotate(-14deg) scale(1.3);
		}
	}
	@keyframes hint {
		from {
			opacity: 0;
			transform: translateX(1rem);
		}
	}
	@keyframes pose {
		from {
			opacity: 0;
			transform: translateX(-3%) scale(1.03);
		}
	}
</style>
