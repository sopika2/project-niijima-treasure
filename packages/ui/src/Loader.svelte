<script lang="ts">
	/**
	 * The landing page's "Take your time" card: ink wiped across the screen, a red band, and
	 * the words in cut-out tiles beside a spinning thief star. Shown while a page takes long
	 * enough to load that you'd otherwise wonder.
	 */
	import { ransom } from './ransom.ts';

	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	const TILES = ['paper', 'ink', 'accent'] as const;
	const words = $derived(
		text
			.toUpperCase()
			.split(/\s+/)
			.filter(Boolean)
			.map((word, w) => {
				let last = -1;
				return ransom(word, w + 40).map((letter) => {
					let pick = letter.pick % TILES.length;
					if (pick === last) pick = (pick + 1) % TILES.length;
					last = pick;
					return { ...letter, tile: TILES[pick] };
				});
			})
	);
</script>

<div class="loader" role="status" aria-live="polite" aria-label={text}>
	<div class="bg" aria-hidden="true"><i class="band"></i><i class="band thin"></i></div>
	<div class="corner" aria-hidden="true">
		<svg class="star" viewBox="0 0 100 100"
			><polygon points="50,3 61,37 97,37 68,59 79,95 50,73 21,95 32,59 3,37 39,37" /></svg
		>
		<span class="words">
			{#each words as word, w (w)}
				<span class="word">
					{#each word as letter, i (i)}
						<span class="tile" data-tile={letter.tile} style={letter.style}
							><span class="face">{letter.char}</span></span
						>
					{/each}
				</span>
			{/each}
		</span>
	</div>
</div>

<style>
	.loader {
		position: fixed;
		z-index: 60;
		inset: 0;
		overflow: hidden;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		animation: wipe 0.38s cubic-bezier(0.7, 0, 0.2, 1) both;
	}
	@keyframes wipe {
		from {
			clip-path: polygon(0 0, 0 0, -18% 100%, -18% 100%);
		}
		to {
			clip-path: polygon(0 0, 118% 0, 100% 100%, -18% 100%);
		}
	}
	.bg::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(
			color-mix(in srgb, var(--tr-color-paper) 22%, transparent) 28%,
			transparent 32%
		);
		background-size: 14px 14px;
		mask-image: linear-gradient(135deg, transparent 35%, black 100%);
		opacity: 0.5;
	}
	.band {
		position: absolute;
		left: -20%;
		width: 140%;
		bottom: 9%;
		height: 26%;
		background: var(--tr-color-accent);
		transform: rotate(-9deg);
		clip-path: polygon(0 22%, 62% 0, 100% 12%, 100% 78%, 38% 100%, 0 88%);
		animation: band 0.5s 0.12s cubic-bezier(0.2, 0.9, 0.2, 1) both;
	}
	.band.thin {
		bottom: 37%;
		height: 1.4%;
		background: var(--tr-color-paper);
		transform: rotate(-14deg);
		clip-path: none;
		animation-delay: 0.18s;
	}
	@keyframes band {
		from {
			translate: -110% 0;
		}
	}
	.corner {
		position: absolute;
		right: max(20px, 4vw);
		bottom: max(20px, 5vh);
		display: flex;
		align-items: flex-end;
		gap: 14px;
	}
	.star {
		width: 72px;
		height: 72px;
		overflow: visible;
		animation: spin 1.1s cubic-bezier(0.6, 0, 0.3, 1) infinite;
	}
	.star polygon {
		fill: var(--tr-color-paper);
		stroke: var(--tr-color-ink);
		stroke-width: 5;
		paint-order: stroke;
		filter: drop-shadow(5px 5px 0 var(--tr-color-accent));
	}
	@keyframes spin {
		50% {
			scale: 0.82;
		}
		100% {
			rotate: 216deg;
		}
	}
	.words {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.06em 0.22em;
		font-size: clamp(30px, 4.4vw, 62px);
		transform: rotate(-4deg);
		transform-origin: 100% 100%;
	}
	.word {
		display: inline-flex;
		align-items: center;
		gap: 0.035em;
	}
	.tile {
		display: inline-block;
		filter: drop-shadow(0.055em 0.055em 0 var(--tr-color-ink));
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-weight: var(--weight);
		transform: translateY(var(--lift)) rotate(var(--turn));
	}
	.face {
		display: block;
		padding: 0.1em 0.13em 0.05em;
		line-height: 0.9;
		clip-path: var(--tear);
	}
	[data-tile='paper'] .face {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	[data-tile='ink'] .face {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
	[data-tile='accent'] .face {
		background: var(--tr-color-accent);
		color: var(--tr-color-paper);
	}
	@media (prefers-reduced-motion: reduce) {
		.loader,
		.loader * {
			animation: none !important;
		}
	}
</style>
