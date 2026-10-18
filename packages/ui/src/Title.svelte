<script lang="ts">
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

	/** Same text, same letters every time: a tiny hash per position, no randomness. */
	function letterStyle(char: string, index: number) {
		const seed = (char.charCodeAt(0) * 31 + index * 17 + text.length * 7) % 97;
		const variant =
			index === 0 ? 'accent' : (['paper', 'ink', 'paper', 'accent', 'ink'] as const)[seed % 5];
		const turn = ((seed % 11) - 5) * 1.3;
		const scale = 0.86 + (seed % 5) * 0.06;
		const lift = ((seed % 7) - 3) * 0.035;
		return { variant, style: `--turn:${turn}deg;--scale:${scale};--lift:${lift}em;--i:${index}` };
	}

	const words = $derived(text.split(/\s+/).filter(Boolean));
</script>

<svelte:element this={level === 1 ? 'h1' : 'h2'} class="title" data-size={size} aria-label={text}>
	<span class="plain">{text}</span>
	<span class="ransom" aria-hidden="true">
		{#each words as word, w (w)}
			<span class="word">
				{#each [...word] as char, i (i)}
					{@const letter = letterStyle(char, w * 13 + i)}
					<span class="chip" data-variant={letter.variant} style={letter.style}>{char}</span>
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
		font-size: calc(1em * var(--scale));
		line-height: 1;
		transform: translateY(var(--lift)) rotate(var(--turn));
		animation: drop var(--tr-duration-slow) var(--tr-ease-emphasized) both;
		animation-delay: calc(var(--i) * 18ms);
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
