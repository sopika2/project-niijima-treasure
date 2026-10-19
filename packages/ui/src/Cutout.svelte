<script lang="ts">
	/**
	 * A word set the way Persona 5 sets its menu: white letters cut from different fonts and
	 * sizes, mixed case, the first one biggest, all sitting on one thick black outline like a
	 * sticker. One letter per word is cut out of a white box instead. Decorative only: give
	 * the readable text to the parent (aria-label or hidden text).
	 */
	import { ransom } from './ransom.ts';

	interface Props {
		text: string;
		/** Changes which letters get which look, so neighbouring words don't repeat. */
		salt?: number;
	}

	let { text, salt = 0 }: Props = $props();

	const letters = $derived.by(() => {
		const list = ransom(text, salt);
		const visible = list.filter((letter) => letter.char.trim()).length;
		// One boxed letter for words of four letters or more, never the first one.
		const boxed = visible >= 4 ? 1 + ((salt * 3 + text.length) % (list.length - 1)) : -1;
		return list.map((letter, index) => ({
			...letter,
			look: index === boxed && letter.char.trim() ? 'box' : 'plain'
		}));
	});
</script>

<span class="sticker" aria-hidden="true">
	{#each letters as letter, i (i)}
		{#if letter.char === ' '}
			<span class="gap"></span>
		{:else}
			<span class="l" class:lower={letter.lower} data-look={letter.look} style={letter.style}
				>{letter.char}</span
			>
		{/if}
	{/each}
</span>

<style>
	.sticker {
		display: inline-flex;
		align-items: baseline;
		line-height: 1;
		white-space: nowrap;
		filter: drop-shadow(0.05em 0.06em 0 var(--tr-color-ink));
	}
	.gap {
		width: 0.3em;
	}
	.l {
		display: inline-block;
		margin-inline: -0.01em;
		color: var(--tr-color-paper);
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-style: normal;
		font-weight: 400;
		text-transform: uppercase;
		/* The black sticker edge: a thick stroke drawn under the white fill, so the letters
		   of a word merge into one outlined shape. */
		-webkit-text-stroke: 0.2em var(--tr-color-ink);
		paint-order: stroke fill;
		transform: translateY(var(--lift)) rotate(var(--turn));
	}
	.l.lower {
		font-size: calc(0.86em * var(--scale));
		text-transform: lowercase;
	}
	/* The one letter cut from a white box. */
	.l[data-look='box'] {
		padding: 0.04em 0.08em 0;
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		-webkit-text-stroke: 0;
		box-shadow: 0 0 0 0.09em var(--tr-color-ink);
	}
</style>
