<script lang="ts">
	/**
	 * The Persona 5 command menu, laid out from the game's own screen (measured against a
	 * 1214×681 capture). Layers, back to front:
	 *
	 *   the page, frozen and soaked in dark red (the game world behind the menu)
	 *   the picture: character art from style.yml, or a stand-in that shifts per command
	 *   the commands, tight and right-aligned as cut-out words on black paper, the highlighted
	 *     one bigger with red and cyan shards behind it that never sit still
	 *   flavour strips, the "Menu: Main" plate and a huge number in the top corner
	 *   the giant heading with one line about the command, the money, the party, the hints
	 *
	 * Up/Down or pointing moves the cursor, Enter or a click goes there, Esc closes.
	 */
	import { onMount } from 'svelte';
	import Cutout from './Cutout.svelte';
	import MenuBackdrop from './MenuBackdrop.svelte';
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

	const current = $derived(items[selected]);
	const number = $derived(String(selected + 1).padStart(2, '0'));
	const artSrc = $derived(
		(current?.key ? art?.commands[current.key] : undefined) ?? art?.default ?? null
	);

	/** The money split into the number and the currency, so the currency can be drawn big. */
	const money = $derived.by(() => {
		const match = wallet?.text.match(/^([^\d-]*)(-?[\d\s.,\u00a0\u202f]*\d)(.*)$/u);
		return match
			? { before: match[1]!.trim(), digits: match[2]!, after: match[3]!.trim() }
			: { before: '', digits: wallet?.text ?? '', after: '' };
	});

	/** How far each line steps left of the stack's right edge, and its lean (from the game). */
	const step = [-1.2, -2.6, -5, -5.6, -6.6, -7.4, -6.2, -5.9, -4.8];
	const lean = [-2, 1, -1, 0, 1, -1, 1, 0, -1];
	const place = (index: number) =>
		`--dx:${step[index % step.length]};--r:${lean[index % lean.length]}deg;--n:${index}`;

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

	/** The corners of the two cursor shards drift to a new spot a few times a second. */
	function jitter(svg: SVGSVGElement) {
		const html = document.documentElement;
		if (html.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		const shapes = [...svg.querySelectorAll('polygon')].map((polygon) => ({
			polygon,
			base: (polygon.getAttribute('points') ?? '').split(' ').map((p) => p.split(',').map(Number))
		}));
		const wobble = (base: number[][]) =>
			base.map(([x, y]) => [x! + (Math.random() * 2 - 1) * 4, y! + (Math.random() * 2 - 1) * 5]);
		let from = shapes.map((shape) => shape.base);
		let to = shapes.map((shape) => wobble(shape.base));
		let start = performance.now();
		let frame = requestAnimationFrame(function loop(now) {
			let t = (now - start) / 240;
			if (t >= 1) {
				from = to;
				to = shapes.map((shape) => wobble(shape.base));
				start = now;
				t = 0;
			}
			shapes.forEach((shape, i) => {
				const points = from[i]!.map((p, k) => {
					const q = to[i]![k]!;
					return `${(p[0]! + (q[0]! - p[0]!) * t).toFixed(1)},${(p[1]! + (q[1]! - p[1]!) * t).toFixed(1)}`;
				});
				shape.polygon.setAttribute('points', points.join(' '));
			});
			frame = requestAnimationFrame(loop);
		});
		return {
			destroy: () => cancelAnimationFrame(frame)
		};
	}

	onMount(() => {
		focusItem(selected);
		const html = document.documentElement;
		const previous = html.style.overflow;
		html.style.overflow = 'hidden';
		return () => {
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
	<div class="world" aria-hidden="true"></div>

	{#if artSrc}
		{#key artSrc}
			<img class="art" src={artSrc} alt="" />
		{/key}
	{:else}
		<MenuBackdrop pose={selected} />
	{/if}

	<span class="strip dark" aria-hidden="true"
		><Cutout text={words.flavor[0]} salt={11} variant="plain" /></span
	>
	<span class="strip light" aria-hidden="true"
		><Cutout text={words.flavor[1]} salt={12} variant="plain" /></span
	>
	<div class="plate" aria-hidden="true">
		<span class="plate-title"><Cutout text={words.plate.title} salt={3} variant="plain" /></span>
		<span class="plate-hint"><Cutout text={words.plate.hint} salt={4} variant="plain" /></span>
	</div>
	{#key selected}
		<span class="number" aria-hidden="true">{number}</span>
	{/key}

	<nav class="commands" aria-label={words.heading}>
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
						{#if index === selected}
							<svg
								class="shards"
								viewBox="0 0 100 100"
								preserveAspectRatio="none"
								aria-hidden="true"
								use:jitter
							>
								<polygon class="red" points="2,58 58,40 104,22 100,96 8,104" />
								<polygon class="cyan" points="-2,8 70,0 66,22 2,30" />
							</svg>
						{/if}
						<Cutout text={item.label} salt={index} />
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<span class="heading" aria-hidden="true"
		><Cutout text={words.heading} salt={9} variant="heading" /></span
	>
	{#key selected}
		<p class="hint" id="command-hint">{current?.hint ?? current?.label}</p>
	{/key}

	{#if wallet}
		<p class="wallet" aria-label="{wallet.label}: {wallet.text}">
			{#if money.before}<b aria-hidden="true">{money.before}</b>{/if}<span aria-hidden="true"
				>{money.digits}</span
			>{#if money.after}<b aria-hidden="true">{money.after}</b>{/if}
		</p>
	{/if}

	{#if party.length > 0}
		<ul class="party" aria-hidden="true">
			{#each party.slice(0, 4) as member, i (i)}
				<li style="--share:{Math.max(0.03, Math.min(1, member.share))};--n:{i}">
					<span class="face"><Cutout text={member.name.slice(0, 2)} salt={20 + i} /></span>
					<span class="bar"><span></span></span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="keys">
		<span class="key" aria-hidden="true"><kbd>↑↓</kbd>{words.move}</span>
		<span class="key" aria-hidden="true"><kbd>⏎</kbd>{words.confirm}</span>
		<button type="button" class="key close" onclick={onclose}><kbd>Esc</kbd>{words.close}</button>
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

	/* The page behind, frozen and drowned in dark red, like the game world behind its menu. */
	.world {
		position: absolute;
		inset: 0;
		background: color-mix(
			in srgb,
			color-mix(in srgb, var(--tr-color-accent) 58%, var(--tr-color-ink)) 88%,
			transparent
		);
		backdrop-filter: blur(4px) grayscale(1) brightness(0.55);
		animation: fade var(--tr-duration-fast) linear both;
	}
	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 30% 50%;
		pointer-events: none;
		animation: pose var(--tr-duration-normal) var(--tr-ease-emphasized) both;
	}

	/* ── Top corner ────────────────────────────────────────────────────────── */
	.strip {
		position: absolute;
		padding: 0.05em 0.3em 0.12em;
		font-size: 5.2vh;
		outline-width: 0.06em;
		outline-style: solid;
		outline-offset: -0.14em;
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) backwards;
	}
	.strip.dark {
		top: -1.5vh;
		left: 66.5vw;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		outline-color: var(--tr-color-paper);
		transform: rotate(-9deg);
		animation-delay: 60ms;
	}
	.strip.light {
		top: 14.5vh;
		left: 72.5vw;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		outline-color: var(--tr-color-ink);
		transform: rotate(-3deg);
		animation-delay: 100ms;
	}
	.plate {
		position: absolute;
		top: 24.5vh;
		left: 78vw;
		display: grid;
		justify-items: center;
		padding: 0.6vh 1.6vh 1vh;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		outline: 2px solid var(--tr-color-paper);
		outline-offset: -6px;
		transform: rotate(-5deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 140ms backwards;
	}
	.plate-title {
		font-size: 5vh;
	}
	.plate-hint {
		margin-top: 0.3vh;
		font-size: 2.1vh;
	}
	.number {
		position: absolute;
		top: 33vh;
		left: 76vw;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-ransom-1);
		font-size: 22vh;
		font-weight: var(--tr-font-ransom-1-weight);
		line-height: 1;
		-webkit-text-stroke: 0.04em var(--tr-color-ink);
		paint-order: stroke fill;
		filter: drop-shadow(0.03em 0.04em 0 var(--tr-color-ink));
		transform: rotate(-6deg) scale(0.72, 1.25);
		transform-origin: left top;
		animation: number var(--tr-duration-fast) var(--tr-ease-emphasized) backwards;
	}

	/* ── The commands ─────────────────────────────────────────────────────── */
	.commands {
		position: absolute;
		top: 26vh;
		left: 0;
		width: 56vw;
		font-size: 4.9vh;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.commands li {
		height: 5.5vh;
		text-align: right;
		transform: translateX(calc(var(--dx) * 1vw)) rotate(var(--r));
		transform-origin: right center;
		transition: height var(--tr-duration-fast) var(--tr-ease-standard);
		animation: deal var(--tr-duration-normal) var(--tr-ease-emphasized) backwards;
		animation-delay: calc(40ms + var(--n) * 30ms);
	}
	.commands li.on {
		height: 7.4vh;
	}
	a {
		position: relative;
		display: inline-block;
		color: inherit;
		text-decoration: none;
		outline: none;
		transform-origin: right center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	li.on a {
		z-index: 3;
		transform: scale(1.3) translate(0.15em, 0.12em) rotate(-1deg);
	}
	/* The highlighted command's letters take a faint tint of the cursor. */
	li.on a :global(.l) {
		color: color-mix(in srgb, var(--tr-color-paper) 88%, var(--tr-color-cursor));
	}
	.shards {
		position: absolute;
		z-index: -2;
		inset: -0.22em -0.45em -0.2em -0.25em;
		width: calc(100% + 0.7em);
		height: calc(100% + 0.42em);
		overflow: visible;
		transform-origin: left center;
		animation: shard var(--tr-duration-fast) var(--tr-ease-emphasized) backwards;
		pointer-events: none;
	}
	.shards .red {
		fill: var(--tr-color-accent);
	}
	.shards .cyan {
		fill: var(--tr-color-cursor);
	}

	/* ── The heading and the line under it ────────────────────────────────── */
	.heading {
		position: absolute;
		top: 70vh;
		left: 43vw;
		font-size: 9vh;
		transform: rotate(-3deg);
		transform-origin: left bottom;
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 120ms backwards;
	}
	.hint {
		position: absolute;
		top: 84.6vh;
		left: 59.2vw;
		margin: 0;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-body);
		font-size: 3vh;
		font-style: italic;
		font-weight: var(--tr-weight-bold);
		-webkit-text-stroke: 0.18em var(--tr-color-ink);
		paint-order: stroke fill;
		transform: rotate(-5deg);
		animation: hint var(--tr-duration-fast) var(--tr-ease-standard) backwards;
	}

	/* ── Money ────────────────────────────────────────────────────────────── */
	.wallet {
		position: absolute;
		top: 80vh;
		left: 26.5vw;
		display: flex;
		align-items: baseline;
		gap: 0.3em;
		margin: 0;
		color: var(--tr-color-paper);
		-webkit-text-stroke: 0.14em var(--tr-color-ink);
		paint-order: stroke fill;
		transform: rotate(-6deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) 160ms backwards;
	}
	.wallet span {
		font-family: var(--tr-font-body);
		font-size: 5.6vh;
		font-style: italic;
		font-weight: var(--tr-weight-bold);
		letter-spacing: -0.02em;
	}
	.wallet b {
		font-family: var(--tr-font-ransom-2, var(--tr-font-heading));
		font-size: 7vh;
		font-weight: var(--tr-font-ransom-2-weight, 400);
	}

	/* ── The party (your accounts) and the button hints ───────────────────── */
	.party {
		position: absolute;
		top: 79vh;
		left: 73.5vw;
		display: flex;
		gap: 0.6vw;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.party li {
		display: grid;
		gap: 0.5vh;
		width: 5.6vw;
		min-width: 3.5rem;
		transform: rotate(-8deg);
		animation: drop var(--tr-duration-normal) var(--tr-ease-emphasized) backwards;
		animation-delay: calc(200ms + var(--n) * 40ms);
	}
	.face {
		display: grid;
		place-items: center;
		height: 7.5vh;
		background: var(--tr-color-ink);
		border: 2px solid var(--tr-color-paper);
		font-size: 3.4vh;
		clip-path: polygon(10% 18%, 40% 0, 70% 6%, 100% 30%, 92% 100%, 0 92%);
	}
	.bar {
		height: 0.75vh;
		min-height: 4px;
		background: var(--tr-color-surface-raised);
		transform: skewX(-30deg);
	}
	.bar span {
		display: block;
		width: calc(var(--share) * 100%);
		height: 100%;
		background: var(--tr-color-cursor);
	}
	.keys {
		position: absolute;
		top: 92.5vh;
		right: 3vw;
		display: flex;
		gap: 1.2vw;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		padding: 0;
		border: 0;
		background: none;
		color: var(--tr-color-paper);
		font-family: var(--tr-font-body);
		font-size: max(0.95rem, 3vh);
		font-style: italic;
		font-weight: var(--tr-weight-bold);
		-webkit-text-stroke: 0.16em var(--tr-color-ink);
		paint-order: stroke fill;
	}
	.close {
		cursor: pointer;
	}
	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.25em;
		height: 1.25em;
		padding: 0 0.2em;
		border-radius: 999px;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-family: var(--tr-font-body);
		font-size: 0.7em;
		font-style: normal;
		-webkit-text-stroke: 0;
		box-shadow: 0 0 0 0.1em var(--tr-color-ink);
	}

	/* ── Tall screens (phones) ─────────────────────────────────────────────── */
	@media (max-aspect-ratio: 4/5) {
		.commands {
			top: 17vh;
			width: 90vw;
			font-size: min(4vh, 8vw);
		}
		.commands li {
			height: 4.6vh;
			transform: translateX(calc(var(--dx) * 0.6vw)) rotate(var(--r));
		}
		.commands li.on {
			height: 6.2vh;
		}
		li.on a {
			transform: scale(1.18) translate(0.1em, 0.08em) rotate(-1deg);
		}
		.strip,
		.number,
		.party,
		.keys .key:not(.close) {
			display: none;
		}
		.plate {
			top: 2vh;
			left: auto;
			right: 4vw;
		}
		.plate-title {
			font-size: 3.2vh;
		}
		.plate-hint {
			font-size: 1.5vh;
		}
		.heading {
			top: auto;
			bottom: 13vh;
			left: 5vw;
			font-size: min(6.5vh, 12vw);
		}
		.hint {
			top: auto;
			bottom: 8vh;
			left: auto;
			right: 6vw;
			font-size: 2.3vh;
		}
		.wallet {
			top: 3vh;
			left: 5vw;
		}
		.wallet span {
			font-size: 3.6vh;
		}
		.wallet b {
			font-size: 4.4vh;
		}
		.keys {
			top: auto;
			bottom: 2.5vh;
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
	@keyframes pose {
		from {
			opacity: 0;
			transform: translateX(-4%) scale(1.04);
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
	@keyframes number {
		from {
			opacity: 0;
			transform: rotate(-16deg) scale(0.9, 1.6);
		}
	}
	@keyframes shard {
		from {
			transform: scaleX(0.1);
		}
	}
	@keyframes hint {
		from {
			opacity: 0;
			transform: translateX(1rem) rotate(-5deg);
		}
	}
</style>
