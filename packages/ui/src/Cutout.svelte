<script lang="ts">
	/**
	 * A word cut out of magazines, the way Persona 5 sets its menu. Every letter from a different
	 * font and size, now and then lower case; one letter per word sits in a white box.
	 *
	 * - backed: white letters on torn black paper, one strip per word (menu commands).
	 * - plain: the letters only, in the current color (on plates and strips that bring
	 *   their own background).
	 * - heading: big outlined letters climbing to the right, the first and last ones
	 *   largest (the giant "COMMAND").
	 *
	 * Decorative only: put the readable text on the parent (aria-label or hidden text).
	 */
	import { ransom } from './ransom.ts';

	interface Props {
		text: string;
		/** Changes the letter mix, so neighbouring words don't look alike. */
		salt?: number;
		variant?: 'backed' | 'plain' | 'heading';
	}

	let { text, salt = 0, variant = 'backed' }: Props = $props();

	const heading = [0.78, 1.05, 1, 0.82, 1.12];

	const letters = $derived.by(() => {
		const list = ransom(text, salt);
		const visible = list.filter((letter) => letter.char.trim()).length;
		const boxed =
			visible >= 4 ? 1 + ((salt * 5 + text.length * 3) % Math.max(1, list.length - 1)) : -1;
		return list.map((letter, index) => {
			const box = index === boxed && /\p{L}|\d/u.test(letter.char);
			if (variant !== 'heading') return { ...letter, box, extra: '' };
			const last = index === list.length - 1;
			const size = index === 0 ? 1.7 : last ? 1.55 : heading[index % heading.length]!;
			return {
				...letter,
				lower: box,
				box,
				extra: `;--scale:${size};--lift:${(-index * 0.045).toFixed(3)}em`
			};
		});
	});
</script>

<span class="word" data-variant={variant} aria-hidden="true">
	{#each letters as letter, i (i)}
		{#if letter.char === ' '}
			<span class="gap"></span>
		{:else}
			<span
				class="l"
				class:lower={letter.lower}
				class:box={letter.box}
				style="{letter.style}{letter.extra}">{letter.char}</span
			>
		{/if}
	{/each}
</span>

<style>
	.word {
		position: relative;
		isolation: isolate;
		display: inline-flex;
		align-items: baseline;
		line-height: 1;
		white-space: nowrap;
	}
	.gap {
		display: inline-block;
		width: 0.32em;
	}
	.l {
		position: relative;
		display: inline-block;
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-style: normal;
		font-weight: var(--weight);
		text-transform: uppercase;
		transform: translateY(var(--lift)) rotate(var(--turn));
	}
	.l.lower {
		text-transform: lowercase;
	}

	/* ── backed: white letters on torn black paper ─────────────────────────── */
	[data-variant='backed'] {
		color: var(--tr-color-paper);
	}
	/* One strip under the whole word, so nothing shows between the letters. */
	[data-variant='backed']::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: 0.02em -0.06em -0.04em;
		background: var(--tr-color-ink);
		clip-path: polygon(0 8%, 30% 0, 62% 6%, 100% 0, 99% 92%, 70% 100%, 35% 94%, 1% 100%);
	}
	/* And a torn scrap behind each letter, poking out of the strip. */
	[data-variant='backed'] .l::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: -0.13em -0.13em -0.09em;
		background: var(--tr-color-ink);
		clip-path: var(--tear);
	}
	[data-variant='backed'] .l {
		-webkit-text-stroke: 0.1em var(--tr-color-ink);
		paint-order: stroke fill;
	}

	/* ── the boxed letter: white paper, the letter drawn in outline ────────── */
	.l.box {
		color: var(--tr-color-paper);
		-webkit-text-stroke: 0.045em var(--tr-color-ink);
		paint-order: stroke fill;
	}
	.l.box::before {
		content: '';
		position: absolute;
		z-index: -1;
		inset: -0.04em -0.04em 0;
		background: var(--tr-color-paper);
		outline: 0.06em solid var(--tr-color-ink);
		clip-path: none;
	}
	[data-variant='plain'] .l.box {
		color: var(--tr-color-paper);
	}

	/* ── heading: giant outlined letters ───────────────────────────────────── */
	[data-variant='heading'] .l {
		color: var(--tr-color-paper);
		-webkit-text-stroke: 0.07em var(--tr-color-ink);
		paint-order: stroke fill;
		filter: drop-shadow(0.03em 0.04em 0 var(--tr-color-ink));
	}
</style>
