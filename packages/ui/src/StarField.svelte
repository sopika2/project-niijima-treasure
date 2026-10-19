<script lang="ts">
	/**
	 * The black-and-white star pattern behind Persona 5's command menu: big five-pointed stars
	 * drawn as nested outlines (black, white, grey), overlapping at different angles.
	 */
	interface Props {
		/** Changes the arrangement. */
		seed?: number;
	}

	let { seed = 5 }: Props = $props();

	function starPoints(cx: number, cy: number, r: number, turn: number): string {
		const inner = r * 0.45;
		return Array.from({ length: 10 }, (_, i) => {
			const radius = i % 2 === 0 ? r : inner;
			const angle = ((turn + i * 36 - 90) * Math.PI) / 180;
			return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
		}).join(' ');
	}

	/** Deterministic pseudo-random numbers so the pattern never jumps between renders. */
	function random(start: number) {
		let state = start * 9301 + 49297;
		return () => {
			state = (state * 9301 + 49297) % 233280;
			return state / 233280;
		};
	}

	const tones = ['ink', 'paper', 'grey', 'paper'] as const;

	const stars = $derived.by(() => {
		const next = random(seed);
		// A few big stars first (drawn underneath), then smaller ones on top.
		const list = [
			{ x: 640, y: 420, r: 560 },
			{ x: 180, y: 900, r: 420 },
			...Array.from({ length: 7 }, () => ({
				x: next() * 1000,
				y: next() * 1000,
				r: 120 + next() * 260
			}))
		];
		return list.map((star) => {
			const turn = next() * 72;
			const rings = Math.max(3, Math.round(star.r / 45));
			const offset = Math.floor(next() * 4);
			return Array.from({ length: rings }, (_, ring) => ({
				points: starPoints(star.x, star.y, star.r * (1 - ring / rings), turn),
				tone: tones[(ring + offset) % tones.length]!
			}));
		});
	});
</script>

<svg class="stars" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
	{#each stars as star, s (s)}
		{#each star as ring, r (r)}
			<polygon points={ring.points} data-tone={ring.tone} />
		{/each}
	{/each}
</svg>

<style>
	.stars {
		display: block;
		width: 100%;
		height: 100%;
	}
	polygon {
		stroke: var(--tr-color-ink);
		stroke-width: 3;
		stroke-linejoin: miter;
	}
	[data-tone='ink'] {
		fill: var(--tr-color-ink);
	}
	[data-tone='paper'] {
		fill: var(--tr-color-paper);
	}
	[data-tone='grey'] {
		fill: color-mix(in srgb, var(--tr-color-paper) 62%, var(--tr-color-ink));
	}
</style>
