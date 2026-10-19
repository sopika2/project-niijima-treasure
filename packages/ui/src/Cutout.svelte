<script lang="ts">
	/**
	 * A word cut out letter by letter, the way Persona 5 sets its menus and titles: every letter
	 * from a different font, on its own torn black scrap; some letters outlined, some inverted on
	 * white. `flip` turns the whole word black-on-white (the highlighted command).
	 * Purely decorative: give the readable text to the parent (aria-label or hidden text).
	 */
	import { ransom } from './ransom.ts';

	interface Props {
		text: string;
		/** Changes which letters get which look, so neighbouring words don't repeat. */
		salt?: number;
		flip?: boolean;
	}

	let { text, salt = 0, flip = false }: Props = $props();

	/** A torn quad: each corner nudged inwards a little, the same way every time. */
	function tear(seed: number): string {
		const n = (k: number) => ((seed * (k + 3) * 37) % 13) - 6;
		return `polygon(${n(1) + 6}% ${n(2) + 6}%, ${94 + n(3)}% ${n(4) + 4}%, ${96 + n(5) / 2}% ${94 + n(6)}%, ${n(7) + 4}% ${96 + n(8) / 2}%)`;
	}

	const letters = $derived(
		ransom(text, salt).map((letter, index) => ({
			...letter,
			look:
				index === 0
					? 'solid'
					: letter.pick === 2
						? 'inverted'
						: letter.pick === 4
							? 'outline'
							: 'solid',
			clip: tear(index * 7 + salt * 11 + (text.charCodeAt(index) || 1))
		}))
	);
</script>

<span class="cutout" class:flip aria-hidden="true">
	{#each letters as letter, i (i)}
		{#if letter.char === ' '}
			<span class="gap"></span>
		{:else}
			<span class="scrap" data-look={letter.look} style="{letter.style};--clip:{letter.clip}"
				><span class="ch" class:lower={letter.lower}>{letter.char}</span></span
			>
		{/if}
	{/each}
</span>

<style>
	.cutout {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		line-height: 1;
	}
	.gap {
		width: 0.32em;
	}
	.scrap {
		display: inline-block;
		margin-inline: -0.035em;
		padding: 0.1em 0.12em 0.05em;
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		clip-path: var(--clip);
		transform: translateY(var(--lift)) rotate(var(--turn));
		transition:
			background-color var(--tr-duration-fast) linear,
			color var(--tr-duration-fast) linear;
	}
	.ch {
		display: inline-block;
		font-family: var(--font);
		font-size: calc(1em * var(--scale));
		font-style: normal;
		font-weight: 400;
		text-transform: uppercase;
	}
	.ch.lower {
		text-transform: lowercase;
	}
	/* Hollow letters: black fill, white edge. */
	[data-look='outline'] .ch {
		color: var(--tr-color-ink);
		-webkit-text-stroke: 0.06em var(--tr-color-paper);
		paint-order: stroke fill;
	}
	[data-look='inverted'] {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
		box-shadow: inset 0 0 0 0.06em var(--tr-color-ink);
	}

	/* The highlighted command: everything turns to black ink on white paper. */
	.flip .scrap {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.flip [data-look='outline'] .ch {
		color: var(--tr-color-paper);
		-webkit-text-stroke-color: var(--tr-color-ink);
	}
	.flip [data-look='inverted'] {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
	}
</style>
