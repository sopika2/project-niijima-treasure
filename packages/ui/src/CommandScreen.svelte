<script lang="ts">
	/**
	 * The command menu, built like the Network screen on niijimasisters.com so the Treasury and
	 * the landing page read as one place. Layers, back to front:
	 *
	 *   ink, a red band and a thin paper band slashed across, an outlined burst and a ghost word
	 *   the in-game calendar (date, weekday, time of day) top left, BACK [Esc] top right
	 *   the menu art for the highlighted command (or its number, outlined) on the right
	 *   the commands down the left; the highlighted one in cut-out letters on a boiling
	 *     red-and-paper blade, the others in plain display type, every row the same height
	 *   a speech box describing the highlighted command, the total, the key hints
	 *
	 * Up/Down or pointing moves the cursor, Enter or a click goes there, Esc closes.
	 */
	import { onMount, tick } from 'svelte';
	import { ransom } from './ransom.ts';
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
	let menu = $state<HTMLElement | null>(null);
	let blade = $state<SVGSVGElement | null>(null);

	const current = $derived(items[selected]);
	const number = $derived(String(selected + 1).padStart(2, '0'));
	const artSrc = $derived(
		(current?.key ? art?.commands[current.key] : undefined) ?? art?.default ?? null
	);

	/* ── The calendar in the corner, like the game's (and the landing page's) ────────────── */
	const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const PHASES: Array<[number, string]> = [
		[0, 'Late night'],
		[5, 'Early morning'],
		[8, 'Morning'],
		[11, 'Lunchtime'],
		[13, 'Afternoon'],
		[16, 'After school'],
		[18, 'Evening'],
		[22, 'Late night']
	];
	let now = $state(new Date());
	const phase = $derived(PHASES.filter(([hour]) => now.getHours() >= hour).at(-1)![1]);
	const clock = $derived(
		`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
	);

	/** A jagged star of `spikes` points, deterministic so it doesn't jump between renders. */
	function burst(spikes: number, outer: number, inner: number, salt: number): string {
		const points: string[] = [];
		for (let i = 0; i < spikes * 2; i++) {
			const angle = (Math.PI * i) / spikes - Math.PI / 2;
			const wobble = Math.abs((Math.sin((i + 1) * 12.9898 * salt) * 43758.5453) % 1) * 0.2;
			const r = i % 2 ? inner * (0.88 + wobble) : outer * (0.8 + wobble);
			points.push(
				`${(50 + Math.cos(angle) * r).toFixed(1)},${(50 + Math.sin(angle) * r).toFixed(1)}`
			);
		}
		return points.join(' ');
	}
	const hudBurst = burst(11, 48, 30, 3);
	const bigBurst = burst(14, 49, 33, 7);

	/* ── The highlighted command in cut-out tiles: ink, red, paper, never twice in a row ─── */
	const TILES = ['ink', 'accent', 'paper'] as const;
	function tiles(text: string, salt: number) {
		let last = -1;
		return ransom(text.toUpperCase(), salt).map((letter, i) => {
			let pick = i === 0 ? 0 : letter.pick % TILES.length;
			if (pick === last) pick = (pick + 1) % TILES.length;
			last = pick;
			return { ...letter, tile: TILES[pick] };
		});
	}

	/* ── The blade behind the highlighted command: three layered shapes that never sit still ── */
	type Shape = Record<'front' | 'back' | 'accent', number[][]>;
	let base: Shape | null = null;
	function shapeFor(link: HTMLElement): Shape | null {
		if (!menu) return null;
		const m = menu.getBoundingClientRect();
		const b = link.getBoundingClientRect();
		if (!b.width) return null;
		const [x, y, w, h] = [b.left - m.left, b.top - m.top, b.width, b.height];
		const dag = Math.max(40, h * 0.78);
		return {
			front: [
				[x - 18, y + 8],
				[x + w + 8, y - 6],
				[x + w + 8 + dag * 0.78, y + h * 0.1],
				[x + w + 8 + dag * 0.46, y + h * 0.36],
				[x + w + 16 + dag * 1.15, y + h * 0.5],
				[x + w + 4, y + h + 4],
				[x - 8, y + h - 3]
			],
			back: [
				[x - 38, y + 20],
				[x + w * 0.45, y + 8],
				[x + w + 30, y + 4],
				[x + w + 30 + dag * 1.05, y + h * 0.26],
				[x + w + 30 + dag * 0.74, y + h * 0.5],
				[x + w + 40 + dag * 1.7, y + h * 0.74],
				[x + w + 12, y + h + 8],
				[x + w * 0.38, y + h + 4],
				[x - 22, y + h + 12]
			],
			accent: [
				[x - 30, y + h * 0.62],
				[x + w * 0.6, y + h * 0.3],
				[x + w + 50, y + h * 0.36],
				[x + w + 60 + dag * 2.3, y + h * 0.66],
				[x + w + 30, y + h + 14],
				[x - 10, y + h + 18]
			]
		};
	}
	const LAYERS = [
		['front', 1],
		['back', 1.4],
		['accent', 1.8]
	] as const;
	function draw(amp: number) {
		if (!base || !blade) return;
		const shape = base;
		const nudge = (scale: number) => (Math.random() * 2 - 1) * amp * scale;
		for (const [name, scale] of LAYERS) {
			const points = shape[name]
				.map(([px, py]) => `${(px! + nudge(scale)).toFixed(1)},${(py! + nudge(scale)).toFixed(1)}`)
				.join(' ');
			blade
				.querySelector(`.${name === 'back' ? 'back-shard' : name}`)
				?.setAttribute('points', points);
		}
	}
	async function place() {
		await tick();
		const link = list?.querySelectorAll<HTMLAnchorElement>('a')[selected];
		base = link ? shapeFor(link) : null;
		draw(0);
		if (blade) {
			blade.classList.remove('pop');
			void blade.getBoundingClientRect();
			blade.classList.add('pop');
		}
	}
	$effect(() => {
		void selected;
		place();
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

	onMount(() => {
		focusItem(selected);
		const html = document.documentElement;
		const previous = html.style.overflow;
		html.style.overflow = 'hidden';
		const calm =
			html.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
		const boil = calm ? 0 : window.setInterval(() => draw(3.2), 110);
		const minute = window.setInterval(() => (now = new Date()), 30_000);
		const resize = () => place();
		window.addEventListener('resize', resize);
		document.fonts?.ready.then(resize);
		return () => {
			html.style.overflow = previous;
			window.clearInterval(boil);
			window.clearInterval(minute);
			window.removeEventListener('resize', resize);
		};
	});

	/** Each line steps right a little and leans its own way, like the landing page's list. */
	const LEAN = [-2, 1.5, -1, 2, -2.5, 1];
	const SIZE = [1, 0.88, 1.05, 0.92, 0.84, 0.97];
</script>

<div
	class="screen"
	role="dialog"
	aria-modal="true"
	aria-label={words.heading}
	tabindex="-1"
	onkeydown={key}
>
	<div class="bg" aria-hidden="true">
		<svg class="burst" viewBox="0 0 100 100"><polygon points={bigBurst} /></svg>
		<span class="band"></span>
		<span class="band thin"></span>
		<span class="ghost">{words.heading}</span>
	</div>

	<div class="hud" aria-hidden="true">
		<svg class="hud-burst" viewBox="0 0 100 100"><polygon points={hudBurst} /></svg>
		<span class="date"
			><span class="m">{now.getMonth() + 1}</span><span class="slash">/</span><span
				>{now.getDate()}</span
			></span
		>
		<span class="dow" class:sun={now.getDay() === 0} class:sat={now.getDay() === 6}
			>{DAYS[now.getDay()]}</span
		>
		<span class="phase">{phase.toUpperCase()}<span class="clock">{clock}</span></span>
	</div>

	<button type="button" class="back" onclick={onclose}
		><i class="back-arrow" aria-hidden="true"></i>{words.close}<kbd>Esc</kbd></button
	>

	<div class="detail" aria-hidden="true">
		{#key selected}
			{#if artSrc}
				<img class="art" src={artSrc} alt="" />
			{:else}
				<span class="numeral">{number}</span>
			{/if}
		{/key}
	</div>

	<nav class="menu" aria-label={words.heading} bind:this={menu}>
		<svg class="blade" bind:this={blade} aria-hidden="true">
			<polygon class="accent" />
			<polygon class="back-shard" />
			<polygon class="front" />
		</svg>
		<ul bind:this={list}>
			{#each items as item, index (item.href)}
				<li style="--i:{index};--r:{LEAN[index % LEAN.length]}deg;--s:{SIZE[index % SIZE.length]}">
					<a
						href={item.href}
						class:on={index === selected}
						aria-current={item.active ? 'page' : undefined}
						aria-describedby={index === selected ? 'command-hint' : undefined}
						onpointerenter={(event) => {
							if (event.pointerType === 'mouse') selected = index;
						}}
						onfocus={() => (selected = index)}
						onclick={() => onclose()}
					>
						<span class="label" class:hidden={index === selected}>{item.label}</span>
						{#if index === selected}
							<span class="tiles" aria-hidden="true">
								{#each tiles(item.label, index) as letter, i (i)}
									<span class="tile" data-tile={letter.tile} style={letter.style}
										><span class="face">{letter.char}</span></span
									>
								{/each}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#key selected}
		<div class="speech">
			<div class="tag"><b>{number}</b><span>{words.plate.title}</span></div>
			<div class="card">
				<p class="card-title">{current?.label}</p>
				<p class="card-hint" id="command-hint">{current?.hint ?? ''}</p>
				{#if current}
					<a class="go" href={current.href} onclick={() => onclose()} tabindex="-1"
						>{words.confirm}<i aria-hidden="true"></i></a
					>
				{/if}
			</div>
		</div>
	{/key}

	{#if wallet}
		<p class="wallet"><b>{wallet.text}</b><span>{wallet.label}</span></p>
	{/if}

	<div class="keys" aria-hidden="true">
		<span><kbd>↑↓</kbd>{words.move}</span>
		<span><kbd>⏎</kbd>{words.confirm}</span>
		<span><kbd>Esc</kbd>{words.close}</span>
	</div>
</div>

<style>
	.screen {
		position: fixed;
		z-index: 40;
		inset: 0;
		overflow: hidden;
		isolation: isolate;
		container-type: size;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		outline: none;
		animation: wipe var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	@keyframes wipe {
		from {
			clip-path: polygon(0 0, 0 0, -18% 100%, -18% 100%);
		}
		to {
			clip-path: polygon(0 0, 118% 0, 100% 100%, -18% 100%);
		}
	}

	/* ── Background: the landing page's slashes ─────────────────────────────── */
	.bg {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
	}
	.band {
		position: absolute;
		left: -15%;
		width: 130%;
		top: 42%;
		height: 32%;
		background: var(--tr-color-accent);
		transform: rotate(-12deg);
		clip-path: polygon(0 16%, 58% 0, 100% 9%, 100% 82%, 41% 100%, 0 90%);
	}
	.band::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(
			color-mix(in srgb, var(--tr-color-ink) 34%, transparent) 30%,
			transparent 34%
		);
		background-size: 13px 13px;
		mask-image: linear-gradient(90deg, transparent 10%, black 55%, transparent 95%);
	}
	.band.thin {
		top: 38.4%;
		height: 1.6%;
		background: var(--tr-color-paper);
		clip-path: polygon(0 30%, 100% 0, 100% 70%, 0 100%);
	}
	.band.thin::after {
		display: none;
	}
	.burst {
		position: absolute;
		right: -9%;
		top: -16%;
		width: min(62cqw, 720px);
		aspect-ratio: 1;
	}
	.burst polygon {
		fill: none;
		stroke: color-mix(in srgb, var(--tr-color-paper) 22%, transparent);
		stroke-width: 0.5;
	}
	.ghost {
		position: absolute;
		left: -1%;
		bottom: -5%;
		font: 400 clamp(100px, 15cqw, 260px) / 0.8 var(--tr-font-heading);
		text-transform: uppercase;
		white-space: nowrap;
		color: transparent;
		-webkit-text-stroke: 2px color-mix(in srgb, var(--tr-color-paper) 22%, transparent);
		opacity: 0.7;
	}

	/* ── The calendar ───────────────────────────────────────────────────────── */
	.hud {
		--hud: clamp(44px, 8cqh, 72px);
		position: absolute;
		z-index: 6;
		left: clamp(26px, 3.4cqw, 56px);
		top: clamp(26px, 5cqh, 50px);
		display: inline-grid;
		grid-template-columns: auto auto;
		align-items: end;
		column-gap: calc(var(--hud) * 0.14);
		row-gap: calc(var(--hud) * 0.1);
		font-family: var(--tr-font-heading);
		transform: rotate(-6deg);
		transform-origin: 0 0;
		user-select: none;
	}
	.hud-burst {
		position: absolute;
		left: calc(var(--hud) * -0.55);
		top: calc(var(--hud) * -0.6);
		z-index: -1;
		width: calc(var(--hud) * 2.4);
		height: calc(var(--hud) * 2.4);
	}
	.hud-burst polygon {
		fill: var(--tr-color-accent);
	}
	.date {
		display: flex;
		align-items: baseline;
		font-size: var(--hud);
		line-height: 0.85;
		text-shadow: calc(var(--hud) * 0.06) calc(var(--hud) * 0.06) 0 var(--tr-color-ink);
	}
	.date .m {
		font-size: 0.72em;
	}
	.slash {
		margin: 0 0.02em;
		font-size: 0.9em;
		color: var(--tr-color-ink);
		text-shadow: none;
		-webkit-text-stroke: 0.04em var(--tr-color-paper);
		transform: skewX(-14deg);
	}
	.dow {
		align-self: center;
		padding: 0.14em 0.3em 0.06em;
		font-size: calc(var(--hud) * 0.38);
		line-height: 1;
		letter-spacing: 0.06em;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		transform: rotate(8deg) translateY(-0.2em);
		clip-path: polygon(0 8%, 100% 0, 94% 100%, 4% 92%);
	}
	.dow.sun {
		background: var(--tr-color-accent);
		color: var(--tr-color-paper);
	}
	.dow.sat {
		background: var(--tr-color-makoto);
		color: var(--tr-color-ink);
	}
	.phase {
		grid-column: 1 / -1;
		justify-self: start;
		display: inline-flex;
		align-items: baseline;
		gap: 0.6em;
		margin-left: calc(var(--hud) * 0.2);
		padding: 0.3em 0.9em 0.22em 0.5em;
		font-size: calc(var(--hud) * 0.3);
		letter-spacing: 0.12em;
		line-height: 1;
		background: var(--tr-color-ink);
		box-shadow: 4px 4px 0 var(--tr-color-accent);
		clip-path: polygon(0 0, 100% 10%, 97% 100%, 1% 88%);
	}
	.clock {
		color: var(--tr-color-text-muted);
		font: 700 0.62em/1 var(--tr-font-body);
		letter-spacing: 0.1em;
	}

	/* ── BACK [Esc] ─────────────────────────────────────────────────────────── */
	.back {
		position: absolute;
		z-index: 9;
		right: clamp(16px, 2.6cqw, 40px);
		top: clamp(16px, 3.4cqh, 32px);
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px 10px 26px;
		border: 0;
		background: none;
		color: var(--tr-color-ink);
		font: 400 24px/1 var(--tr-font-heading);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transform: rotate(3deg);
		transition: transform var(--tr-duration-fast) var(--tr-ease-emphasized);
	}
	.back::before,
	.back::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(12% 0, 100% 8%, 95% 100%, 0 86%);
	}
	.back::before {
		z-index: -1;
		background: var(--tr-color-paper);
	}
	.back::after {
		z-index: -2;
		background: var(--tr-color-accent);
		transform: translate(-8px, 7px);
	}
	.back:hover,
	.back:focus-visible {
		color: var(--tr-color-paper);
		transform: rotate(3deg) scale(1.07);
	}
	.back:hover::before,
	.back:focus-visible::before {
		background: var(--tr-color-accent);
	}
	.back:hover::after,
	.back:focus-visible::after {
		background: var(--tr-color-paper);
	}
	.back-arrow {
		width: 0.62em;
		height: 0.72em;
		background: currentColor;
		clip-path: polygon(100% 0, 0 50%, 100% 100%, 76% 50%);
	}
	.back kbd {
		padding: 5px 6px 4px;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		font: 700 11px/1 var(--tr-font-body);
		letter-spacing: 0.14em;
		transform: rotate(-6deg);
	}

	/* ── The art (or the command's number) on the right ────────────────────── */
	.detail {
		position: absolute;
		z-index: 1;
		right: 0;
		top: 0;
		bottom: 0;
		width: 58%;
		pointer-events: none;
	}
	.art {
		position: absolute;
		right: -2%;
		top: 0;
		height: 64%;
		max-width: 66%;
		object-fit: contain;
		object-position: 50% 0;
		filter: drop-shadow(-14px 10px 0 var(--tr-color-accent))
			drop-shadow(10px 8px 0 var(--tr-color-paper));
		animation: bust var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	.numeral {
		position: absolute;
		right: 10%;
		top: 4%;
		font: 400 clamp(160px, 46cqh, 420px) / 0.8 var(--tr-font-heading);
		letter-spacing: -0.02em;
		color: transparent;
		-webkit-text-stroke: 3px var(--tr-color-paper);
		opacity: 0.22;
		transform: rotate(-8deg);
		animation: bust var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	@keyframes bust {
		from {
			opacity: 0;
			translate: 9% 0;
		}
	}

	/* ── The commands ───────────────────────────────────────────────────────── */
	.menu {
		/* Eight commands have to fit between the calendar and the total at any height. */
		--mfs: clamp(24px, min(4.2cqw, 5.4cqh), 68px);
		position: absolute;
		z-index: 3;
		left: clamp(16px, 4cqw, 64px);
		top: clamp(150px, 24cqh, 230px);
		width: min(52%, 760px);
	}
	.menu ul {
		position: relative;
		z-index: 1;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Every row the same height: the selection never moves the rows under the cursor. */
	.menu li {
		display: flex;
		align-items: center;
		height: calc(var(--mfs) * 1.06);
		transform: translateX(calc(var(--i) * 2.3cqw)) rotate(var(--r));
		transform-origin: 0 50%;
	}
	.menu li + li {
		margin-top: calc(var(--mfs) * 0.22);
	}
	.menu a {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 0.06em 0.22em 0.02em 0.12em;
		color: var(--tr-color-paper);
		font: 400 calc(var(--mfs) * var(--s)) / 0.98 var(--tr-font-heading);
		letter-spacing: 0.01em;
		text-decoration: none;
		text-transform: uppercase;
		-webkit-text-stroke: 0.055em var(--tr-color-ink);
		paint-order: stroke fill;
		text-shadow: 0.06em 0.06em 0 var(--tr-color-ink);
		transform: skewX(-8deg);
		transform-origin: 0 50%;
		outline: none;
	}
	.menu a.on {
		transform: rotate(-3deg) skewX(-6deg);
	}
	.label.hidden {
		position: absolute;
		opacity: 0;
	}
	.tiles {
		display: inline-flex;
		align-items: center;
		gap: 0.035em;
		font-size: 1.05em;
		-webkit-text-stroke: 0;
		text-shadow: none;
	}
	.tile {
		display: inline-block;
		filter: drop-shadow(0.055em 0.055em 0 var(--tr-color-ink));
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-weight: var(--weight);
		transform: translateY(var(--lift)) rotate(var(--turn));
		animation: tile-in var(--tr-duration-normal) var(--tr-ease-emphasized) both;
		animation-delay: calc(var(--i) * 26ms);
	}
	.face {
		display: block;
		padding: 0.1em 0.13em 0.05em;
		line-height: 0.9;
		clip-path: var(--tear);
	}
	[data-tile='ink'] .face {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	[data-tile='accent'] .face {
		background: var(--tr-color-accent);
		color: var(--tr-color-paper);
	}
	[data-tile='paper'] .face {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	@keyframes tile-in {
		from {
			opacity: 0;
			transform: translateY(-0.35em) rotate(calc(var(--turn) * -4)) scale(1.7);
		}
	}

	.blade {
		position: absolute;
		inset: 0;
		z-index: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.blade polygon {
		transform-box: fill-box;
		transform-origin: 0 50%;
		stroke-linejoin: miter;
	}
	.blade .accent {
		fill: var(--tr-color-makoto);
	}
	.blade .back-shard {
		fill: var(--tr-color-accent);
		stroke: var(--tr-color-ink);
		stroke-width: 4px;
	}
	.blade .front {
		fill: var(--tr-color-paper);
		stroke: var(--tr-color-ink);
		stroke-width: 5px;
		stroke-miterlimit: 12;
	}
	:global(.blade.pop) polygon {
		animation: pop 0.2s var(--tr-ease-emphasized) both;
	}
	:global(.blade.pop) .back-shard {
		animation-delay: 0.03s;
	}
	:global(.blade.pop) .accent {
		animation-delay: 0.06s;
	}
	@keyframes pop {
		from {
			opacity: 0.3;
			transform: scaleX(0.25) skewX(-24deg);
		}
	}

	/* ── The speech box ─────────────────────────────────────────────────────── */
	.speech {
		position: absolute;
		z-index: 4;
		left: 51%;
		bottom: clamp(56px, 8cqh, 84px);
		width: min(34%, 500px);
		transform: rotate(-3deg);
		transform-origin: 0 100%;
		filter: drop-shadow(-6px 6px 0 var(--tr-color-ink))
			drop-shadow(10px 9px 0 var(--tr-color-makoto));
		animation: speech var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}
	@keyframes speech {
		from {
			opacity: 0;
			transform: rotate(-9deg) scale(0.86) translate(-24px, 18px);
		}
	}
	.card {
		padding: 38px 36px 28px 32px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		clip-path: polygon(0 4%, 60% 0, 100% 3%, 98% 100%, 2% 96%);
	}
	/* The tail, pointing up at the art. */
	.speech::before {
		content: '';
		position: absolute;
		right: 14%;
		top: -46px;
		width: 70px;
		height: 60px;
		background: var(--tr-color-paper);
		clip-path: polygon(0 100%, 55% 30%, 40% 55%, 100% 0, 70% 100%);
	}
	.tag {
		position: absolute;
		z-index: 2;
		left: 5%;
		top: -16px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 18px 6px 12px;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		transform: rotate(-4deg);
		clip-path: polygon(0 0, 100% 8%, 96% 100%, 2% 92%);
	}
	.tag b {
		color: var(--tr-color-makoto);
		font: 400 30px/1 var(--tr-font-heading);
	}
	.tag span {
		font: 700 13px/16px var(--tr-font-body);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.card-title {
		margin: 0;
		font: 400 clamp(32px, min(3.4cqw, 6cqh), 52px) / 0.95 var(--tr-font-heading);
		text-transform: uppercase;
	}
	.card-hint {
		margin: 10px 0 18px;
		font: 500 clamp(15px, 1.2cqw, 17px) / 1.4 var(--tr-font-body);
	}
	.go {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 11px 24px 9px 20px;
		color: var(--tr-color-paper);
		font: 400 20px/1 var(--tr-font-heading);
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
		transform: rotate(-3deg);
	}
	.go::before,
	.go::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(3% 6%, 100% 0, 96% 100%, 0 90%);
	}
	.go::before {
		z-index: -1;
		background: var(--tr-color-ink);
	}
	.go::after {
		z-index: -2;
		background: var(--tr-color-accent);
		transform: translate(6px, 6px);
	}
	.go i {
		width: 0.6em;
		height: 0.7em;
		background: currentColor;
		clip-path: polygon(0 0, 100% 50%, 0 100%, 22% 50%);
	}

	/* ── The total, like the landing page's ONLINE counter ──────────────────── */
	.wallet {
		position: absolute;
		z-index: 7;
		left: clamp(18px, 3cqw, 46px);
		bottom: clamp(20px, 4cqh, 38px);
		display: inline-flex;
		align-items: baseline;
		gap: 12px;
		margin: 0;
		padding: 5px 20px 3px 16px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		border: 4px solid var(--tr-color-ink);
		box-shadow: 8px 8px 0 var(--tr-color-accent);
		transform: rotate(-3deg) skewX(-14deg);
		transform-origin: 0 100%;
		white-space: nowrap;
	}
	.wallet b {
		color: var(--tr-color-accent);
		font: 400 clamp(28px, 4cqh, 46px) / 1 var(--tr-font-heading);
	}
	.wallet span {
		font: 400 clamp(16px, 2.4cqh, 24px) / 1 var(--tr-font-heading);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.keys {
		position: absolute;
		z-index: 6;
		right: clamp(16px, 2.6cqw, 40px);
		bottom: clamp(10px, 2cqh, 18px);
		display: flex;
		gap: 14px;
		padding: 5px 9px 4px;
		background: var(--tr-color-ink);
		color: var(--tr-color-text-muted);
		font: 600 12px/1.3 var(--tr-font-body);
		letter-spacing: 0.06em;
	}
	.keys kbd {
		margin-inline-end: 5px;
		padding: 0 4px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font: 700 11px/1.3 var(--tr-font-body);
	}

	/* ── Phones ─────────────────────────────────────────────────────────────── */
	@media (max-width: 759.98px) {
		.hud {
			--hud: 44px;
			left: 16px;
			top: 18px;
		}
		.back {
			top: 14px;
			right: 12px;
			font-size: 18px;
			padding: 10px 14px 8px 20px;
		}
		.back kbd,
		.keys,
		.detail {
			display: none;
		}
		.menu {
			--mfs: clamp(22px, min(8.4cqw, 4.2cqh), 40px);
			left: 12px;
			top: clamp(120px, 19cqh, 170px);
			width: 78%;
		}
		.menu li {
			transform: translateX(calc(var(--i) * 2.2cqw)) rotate(var(--r));
		}
		.speech {
			left: 14px;
			right: 18px;
			width: auto;
			bottom: 92px;
		}
		.card {
			padding: 28px 24px 20px 22px;
		}
		.card-title {
			font-size: 32px;
		}
		.wallet {
			left: 14px;
			bottom: 18px;
			gap: 9px;
			padding: 3px 14px 2px 12px;
			border-width: 3px;
			box-shadow: 6px 6px 0 var(--tr-color-accent);
		}
		.band {
			top: 30%;
			height: 24%;
		}
		.band.thin {
			top: 27%;
			height: 1.2%;
		}
		.burst {
			width: 110cqw;
			right: -40%;
			top: -6%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.screen,
		.screen * {
			animation: none !important;
		}
	}
</style>
