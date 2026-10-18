<script lang="ts">
	/**
	 * The Persona-style command menu: cut-out words cascading down a white silhouette, a red
	 * slash and a starburst behind them, the money counter at the bottom. Used as the sidebar on
	 * wide screens ("rail") and as the full-screen menu on phones ("full").
	 */
	import type { Snippet } from 'svelte';
	import { ransom } from './ransom.ts';
	import type { NavItem } from './types.ts';

	interface Props {
		items: readonly NavItem[];
		variant: 'rail' | 'full';
		/** The little plate in the corner, e.g. "Menu: Main" / "Select a command". */
		plate?: { title: string; hint: string };
		wallet?: { label: string; text: string } | null;
		/** Above the menu: the brand on the rail. */
		top?: Snippet;
		/** Below the menu, before the wallet: the Add button on the rail. */
		extra?: Snippet;
		onpick?: () => void;
	}

	let { items, variant, plate, wallet = null, top, extra, onpick }: Props = $props();

	/** Where each line sits: a hand-placed cascade, the way the game staggers its menu. */
	const cascade = [
		{ x: 0.1, r: -5, s: 1.08 },
		{ x: 1.1, r: -2, s: 0.94 },
		{ x: 1.7, r: -6, s: 1 },
		{ x: 1.2, r: -1, s: 0.9 },
		{ x: 0.5, r: -4, s: 1.02 },
		{ x: 1.4, r: -7, s: 0.96 },
		{ x: 2, r: -3, s: 1.04 },
		{ x: 1, r: -5, s: 0.92 },
		{ x: 0.3, r: -2, s: 1 }
	];
	const place = (index: number) => {
		const spot = cascade[index % cascade.length]!;
		return `--x:${spot.x}em;--r:${spot.r}deg;--s:${spot.s};--n:${index}`;
	};
</script>

<div class="command" data-variant={variant}>
	<div class="art" aria-hidden="true">
		<span class="burst"></span>
		<span class="blob"></span>
		<span class="dots"></span>
		<span class="slash"></span>
	</div>

	{#if top}<div class="top">{@render top()}</div>{/if}

	{#if plate}
		<p class="plate" aria-hidden="true">
			<span class="plate-title">
				{#each ransom(plate.title, 3) as letter, i (i)}<span
						class="glyph"
						class:lower={letter.lower}
						style={letter.style}>{letter.char === ' ' ? '\u00a0' : letter.char}</span
					>{/each}
			</span>
			<span class="plate-hint">
				{#each ransom(plate.hint, 5) as letter, i (i)}<span
						class="glyph"
						class:lower={letter.lower}
						style={letter.style}>{letter.char === ' ' ? '\u00a0' : letter.char}</span
					>{/each}
			</span>
		</p>
	{/if}

	<ul class="list">
		{#each items as item, index (item.href)}
			<li style={place(index)}>
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					aria-label={item.label}
					onclick={() => onpick?.()}
				>
					<span class="word" aria-hidden="true">
						{#each ransom(item.label, index) as letter, i (i)}<span
								class="glyph"
								class:lower={letter.lower}
								data-pick={letter.pick}
								style={letter.style}>{letter.char === ' ' ? '\u00a0' : letter.char}</span
							>{/each}
					</span>
				</a>
			</li>
		{/each}
	</ul>

	{#if extra}<div class="extra">{@render extra()}</div>{/if}

	{#if wallet}
		<p class="wallet">
			<span class="wallet-label">{wallet.label}</span>
			<span class="wallet-amount">{wallet.text}</span>
		</p>
	{/if}
</div>

<style>
	.command {
		position: relative;
		isolation: isolate;
		display: flex;
		flex-direction: column;
		gap: var(--tr-space-md);
		min-height: 100%;
		padding: var(--tr-space-lg) var(--tr-space-md) var(--tr-space-lg) var(--tr-space-lg);
		/* clip, not hidden: focusing a link must never scroll the picture sideways. */
		overflow: clip;
		background: color-mix(in srgb, var(--tr-color-accent) 38%, var(--tr-color-ink));
		color: var(--tr-color-paper);
	}

	/* ── The picture behind the words ─────────────────────────────────────── */
	.art,
	.art > span {
		position: absolute;
		pointer-events: none;
	}
	.art {
		inset: 0;
		z-index: -1;
	}
	/* The black-and-white starburst. */
	.burst {
		inset: 42% -45% -20% 20%;
		background: repeating-conic-gradient(
			from 4deg at 45% 40%,
			var(--tr-color-ink) 0deg 7deg,
			var(--tr-color-paper) 7deg 10deg,
			var(--tr-color-ink) 10deg 17deg,
			color-mix(in srgb, var(--tr-color-paper) 55%, var(--tr-color-ink)) 17deg 21deg
		);
		clip-path: polygon(30% 0, 100% 8%, 100% 100%, 0 100%, 14% 52%, 4% 40%);
		opacity: 0.85;
	}
	/* The white silhouette the menu is written on. */
	.blob {
		inset: 14% 10% 24% -18%;
		background: var(--tr-color-paper);
		clip-path: polygon(
			8% 4%,
			34% 0,
			44% 9%,
			63% 2%,
			72% 14%,
			92% 10%,
			86% 30%,
			100% 41%,
			88% 55%,
			96% 72%,
			74% 78%,
			80% 96%,
			52% 88%,
			38% 100%,
			24% 86%,
			6% 92%,
			12% 70%,
			0 52%,
			10% 34%,
			2% 18%
		);
		transform: rotate(-4deg);
	}
	.dots {
		inset: 10% 8% 52% 46%;
		background: radial-gradient(circle, var(--tr-color-ink) 1.6px, transparent 1.9px) 0 0 / 8px 8px;
		clip-path: polygon(20% 0, 100% 10%, 80% 100%, 0 70%);
		transform: rotate(-4deg);
	}
	/* The red slash across it. */
	.slash {
		inset: 22% -6% 34% 30%;
		background: var(--tr-color-accent);
		clip-path: polygon(
			30% 0,
			100% 6%,
			92% 22%,
			46% 18%,
			88% 84%,
			100% 100%,
			10% 96%,
			22% 80%,
			58% 84%,
			16% 24%
		);
		transform: rotate(-6deg);
	}

	.top,
	.extra {
		position: relative;
	}

	/* ── "Menu: Main" plate ───────────────────────────────────────────────── */
	.plate {
		position: relative;
		align-self: flex-end;
		display: grid;
		justify-items: center;
		margin: 0;
		padding: 0.3em 0.7em 0.35em;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		border: 2px solid var(--tr-color-paper);
		box-shadow: 4px 4px 0 var(--tr-color-ink);
		transform: rotate(-5deg);
		line-height: 1;
	}
	.plate-title {
		font-size: 1.35rem;
	}
	.plate-hint {
		font-size: 0.7rem;
	}

	/* ── The words ────────────────────────────────────────────────────────── */
	.glyph {
		display: inline-block;
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-weight: 400;
		font-style: normal;
		line-height: 0.95;
		text-transform: uppercase;
		transform: translateY(var(--lift)) rotate(var(--turn));
	}
	.glyph.lower {
		text-transform: lowercase;
	}

	.list {
		position: relative;
		display: grid;
		gap: 0.08em;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: min(1.9rem, 3.7dvh);
		letter-spacing: 0.02em;
	}
	.list li {
		transform: translateX(var(--x)) rotate(var(--r));
		transform-origin: left center;
		animation: enter var(--tr-duration-slow) var(--tr-ease-emphasized) both;
		animation-delay: calc(var(--n) * 45ms);
	}
	.list a {
		position: relative;
		isolation: isolate;
		display: inline-block;
		padding: 0.04em 0.25em;
		color: var(--tr-color-paper);
		font-size: calc(1em * var(--s));
		text-decoration: none;
		white-space: nowrap;
		transform-origin: left center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	/* White letters with a thick black outline read on the white and on the dark parts alike. */
	.list a .glyph {
		text-shadow:
			-2px -2px 0 var(--tr-color-ink),
			2px -2px 0 var(--tr-color-ink),
			-2px 2px 0 var(--tr-color-ink),
			2px 2px 0 var(--tr-color-ink),
			0 -2px 0 var(--tr-color-ink),
			0 2px 0 var(--tr-color-ink),
			-2px 0 0 var(--tr-color-ink),
			2px 0 0 var(--tr-color-ink),
			4px 4px 0 var(--tr-color-ink);
	}
	/* The selected line: a red jagged blade behind it, letters cut out of white paper. */
	.list a::before {
		content: '';
		position: absolute;
		inset: -0.18em -0.9em -0.22em -0.3em;
		z-index: -1;
		background: var(--tr-color-accent);
		clip-path: polygon(0 18%, 100% 0, 84% 52%, 96% 100%, 6% 86%);
		transform: scaleX(0);
		transform-origin: left center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	.list a:hover,
	.list a:focus-visible,
	.list a[aria-current='page'] {
		outline: none;
		transform: translateX(0.25em) scale(1.08) rotate(-3deg);
	}
	.list a:hover::before,
	.list a:focus-visible::before,
	.list a[aria-current='page']::before {
		transform: scaleX(1);
	}
	.list a:hover .glyph,
	.list a:focus-visible .glyph,
	.list a[aria-current='page'] .glyph {
		padding: 0 0.06em;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		text-shadow: none;
		outline: 2px solid var(--tr-color-ink);
		box-shadow: 3px 3px 0 var(--tr-color-ink);
	}
	.list a:hover .glyph[data-pick='2'],
	.list a:focus-visible .glyph[data-pick='2'],
	.list a[aria-current='page'] .glyph[data-pick='2'] {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		outline-color: var(--tr-color-paper);
		box-shadow: 3px 3px 0 var(--tr-color-ink);
	}
	/* While you point at another line, the current page lets go of the highlight, like a cursor. */
	.list:has(a:hover, a:focus-visible) a[aria-current='page']:not(:hover, :focus-visible) {
		transform: none;
	}
	.list:has(a:hover, a:focus-visible) a[aria-current='page']:not(:hover, :focus-visible)::before {
		transform: scaleX(0);
	}
	.list:has(a:hover, a:focus-visible) a[aria-current='page']:not(:hover, :focus-visible) .glyph {
		padding: 0;
		background: none;
		color: var(--tr-color-paper);
		outline: none;
		box-shadow: none;
		text-shadow:
			-2px -2px 0 var(--tr-color-ink),
			2px -2px 0 var(--tr-color-ink),
			-2px 2px 0 var(--tr-color-ink),
			2px 2px 0 var(--tr-color-ink),
			4px 4px 0 var(--tr-color-ink);
	}

	/* ── The money counter ────────────────────────────────────────────────── */
	.wallet {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 0.15em;
		margin: auto 0 0;
		transform: rotate(-6deg);
		transform-origin: left bottom;
	}
	.wallet-label {
		padding: 0.1em 0.5em;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		font-size: var(--tr-text-xs);
		font-weight: var(--tr-weight-bold);
	}
	.wallet-amount {
		font-family: var(--tr-font-heading);
		font-size: 2rem;
		font-style: italic;
		line-height: 1;
		white-space: nowrap;
		text-shadow:
			-2px -2px 0 var(--tr-color-ink),
			2px -2px 0 var(--tr-color-ink),
			-2px 2px 0 var(--tr-color-ink),
			2px 2px 0 var(--tr-color-ink),
			5px 5px 0 var(--tr-color-accent);
	}

	/* ── The full-screen version on phones ────────────────────────────────── */
	[data-variant='full'] {
		padding: var(--tr-space-lg) var(--tr-space-lg) var(--tr-space-xl);
	}
	[data-variant='full'] .plate {
		align-self: flex-start;
	}
	[data-variant='full'] .list {
		margin-block: auto;
		font-size: clamp(2.2rem, 10vw, 3rem);
	}
	[data-variant='full'] .blob {
		inset: 12% 4% 20% -14%;
	}
	[data-variant='full'] .wallet-amount {
		font-size: 2.5rem;
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translateX(-120%) rotate(-14deg);
		}
	}
</style>
