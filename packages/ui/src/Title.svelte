<script lang="ts">
	import { ransom } from './ransom.ts';
	/**
	 * A page title. With title_style: ransom in style.yml, every letter is a cut-out chip
	 * (paper, ink or accent, each tilted a little), like a calling card. The full text stays
	 * readable to screen readers; the chips are decoration on top of it.
	 */
	interface Props {
		text: string;
		level?: 1 | 2;
		size?: 'md' | 'lg' | 'xl';
	}

	let { text, level = 1, size = 'lg' }: Props = $props();

	/** Same text, same letters every time: fonts, tilts and sizes come from ransom(). */
	const variants = ['paper', 'ink', 'paper', 'accent', 'ink'] as const;
	const variantOf = (index: number, pick: number) => (index === 0 ? 'accent' : variants[pick]);

	const words = $derived(text.split(/\s+/).filter(Boolean));
</script>

<svelte:element this={level === 1 ? 'h1' : 'h2'} class="title" data-size={size} aria-label={text}>
	<span class="plain">{text}</span>
	<span class="ransom" aria-hidden="true">
		{#each words as word, w (w)}
			<span class="word">
				{#each ransom(word, w) as letter, i (i)}
					<span
						class="chip"
						class:lower={letter.lower}
						data-variant={variantOf(w + i, letter.pick)}
						style={letter.style}>{letter.char}</span
					>
				{/each}
			</span>
		{/each}
	</span>
</svelte:element>

<style>
	.title {
		margin: 0;
		line-height: 1;
	}
	.title[data-size='md'] {
		font-size: var(--tr-text-xl);
	}
	.title[data-size='lg'] {
		font-size: clamp(2.2rem, 7vw, var(--tr-text-xxl));
	}
	.title[data-size='xl'] {
		font-size: clamp(2.8rem, 11vw, 5rem);
	}

	.ransom {
		display: none;
	}
	:global([data-title='ransom']) .plain {
		display: none;
	}
	:global([data-title='ransom']) .ransom {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.08em 0.32em;
		font-style: normal;
	}
	.word {
		display: inline-flex;
		align-items: center;
		gap: 0.04em;
	}
	.chip {
		display: inline-block;
		padding: 0.06em 0.12em 0.02em;
		font-family: var(--font, inherit);
		font-size: calc(1em * var(--scale));
		font-style: normal;
		font-weight: 400;
		line-height: 1;
		text-transform: uppercase;
		transform: translateY(var(--lift)) rotate(var(--turn));
		animation: drop var(--tr-duration-slow) var(--tr-ease-emphasized) both;
		animation-delay: calc(var(--i) * 18ms);
	}
	.chip.lower {
		text-transform: lowercase;
	}
	.chip[data-variant='paper'] {
		background: var(--tr-color-paper);
		color: var(--tr-color-ink);
	}
	.chip[data-variant='ink'] {
		background: var(--tr-color-ink);
		color: var(--tr-color-paper);
		outline: 2px solid var(--tr-color-paper);
		outline-offset: -2px;
	}
	.chip[data-variant='accent'] {
		background: var(--tr-color-accent);
		color: var(--tr-color-accent-text);
	}

	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-0.4em) rotate(calc(var(--turn) * -2));
		}
	}
</style>
