<script lang="ts">
	/**
	 * The picture behind the command menu when no character art is set: a torn paper card
	 * where the character's hand would be, a red slash across it, a black body sweeping in
	 * from below with a patch of halftone, and the op-art star field on the right. Like the
	 * game swapping poses, every command shifts and turns the pieces a little.
	 */
	interface Props {
		/** Index of the highlighted command; each one has its own pose. */
		pose: number;
	}

	let { pose }: Props = $props();

	function starPoints(cx: number, cy: number, r: number, turn: number): string {
		return Array.from({ length: 10 }, (_, i) => {
			const radius = i % 2 === 0 ? r : r * 0.46;
			const angle = ((turn + i * 36 - 90) * Math.PI) / 180;
			return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
		}).join(' ');
	}

	/** Bands from the outside in: black and white with the odd grey, like the game's stars. */
	const tones = ['ink', 'paper', 'grey', 'paper', 'ink', 'paper', 'light', 'paper'] as const;

	const stars = (() => {
		let state = 11;
		const next = () => (state = (state * 9301 + 49297) % 233280) / 233280;
		const list: [number, number, number][] = [
			[1180, 330, 520],
			[1480, 780, 380],
			[900, 820, 300],
			[1500, 120, 260]
		];
		for (let k = 0; k < 9; k += 1) list.push([780 + next() * 820, next() * 900, 70 + next() * 170]);
		return list.flatMap(([x, y, r]) => {
			const turn = next() * 72;
			const rings = Math.max(4, Math.round(r / 22));
			const offset = Math.floor(next() * tones.length);
			return Array.from({ length: rings }, (_, ring) => ({
				points: starPoints(x, y, r * (1 - ring / rings), turn),
				tone: tones[(ring + offset) % tones.length]!,
				edge: ring === 0
			}));
		});
	})();

	/** A torn paper card: a rough quadrilateral whose edges are ripped into small jags. */
	const card = (() => {
		const corners = [
			[470, 150],
			[860, 92],
			[905, 575],
			[515, 640]
		];
		const points: string[] = [];
		let state = 5;
		const next = () => (state = (state * 9301 + 49297) % 233280) / 233280;
		corners.forEach(([x1, y1], side) => {
			const [x2, y2] = corners[(side + 1) % corners.length]!;
			const steps = 9;
			for (let step = 0; step < steps; step += 1) {
				const t = step / steps;
				const nx = -(y2! - y1!);
				const ny = x2! - x1!;
				const length = Math.hypot(nx, ny);
				const push = step === 0 ? 0 : (next() * 2 - 1) * 16;
				points.push(
					`${(x1! + (x2! - x1!) * t + (nx / length) * push).toFixed(1)},${(y1! + (y2! - y1!) * t + (ny / length) * push).toFixed(1)}`
				);
			}
		});
		return points.join(' ');
	})();

	/* [card turn, card shift, slash turn, body shift] per command. */
	const poses = [
		[0, 0, 0, 0],
		[-4, 8, -14, 6],
		[3, -6, 10, -4],
		[-2, 12, -6, 10],
		[5, -10, 14, -8],
		[-6, 4, -18, 2],
		[2, -12, 8, -12],
		[-3, 6, -10, 8]
	] as const;
	const current = $derived(poses[pose % poses.length]!);
</script>

<svg
	class="backdrop"
	viewBox="0 0 1600 900"
	preserveAspectRatio="xMidYMid slice"
	aria-hidden="true"
	style="--card:rotate({current[0]}deg) translate({current[1]}px, 0);--slash:rotate({current[2]}deg) translate({current[1] *
		2}px, {-current[1]}px);--body:translate({current[3] * 3}px, 0) rotate({current[0] /
		2}deg);--stars:rotate({current[2] / 2}deg) scale(1.1)"
>
	<defs>
		<clipPath id="menu-star-edge">
			<polygon
				points="900,0 1600,0 1600,900 760,900 800,760 730,690 820,560 770,470 860,330 820,200"
			/>
		</clipPath>
		<pattern id="menu-dots" width="12" height="12" patternUnits="userSpaceOnUse">
			<circle class="paper" cx="6" cy="6" r="3.2" />
		</pattern>
	</defs>
	<g clip-path="url(#menu-star-edge)">
		<g class="stars">
			<rect class="paper" width="1600" height="900" />
			{#each stars as ring, i (i)}
				<polygon points={ring.points} class={ring.tone} class:edge={ring.edge} />
			{/each}
		</g>
	</g>
	<g class="card">
		<polygon class="light outline" points={card} />
	</g>
	<g class="body">
		<polygon class="ink" points="560,900 700,690 905,560 1080,520 1240,600 1330,760 1380,900" />
		<polygon class="dots" points="980,560 1150,530 1170,690 1080,730 990,710" />
	</g>
	<g class="slash">
		<polygon class="red outline" points="770,210 1060,150 880,500 1030,560 720,660 820,440" />
	</g>
</svg>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	g {
		transform-box: fill-box;
		transform-origin: center;
		transition: transform var(--tr-duration-normal) var(--tr-ease-emphasized);
	}
	.card {
		transform: var(--card);
		animation: card var(--tr-duration-normal) var(--tr-ease-emphasized) backwards;
	}
	.slash {
		transform: var(--slash);
		animation: slash var(--tr-duration-normal) var(--tr-ease-emphasized) 60ms backwards;
	}
	.body {
		transform: var(--body);
		animation: body var(--tr-duration-normal) var(--tr-ease-emphasized) 30ms backwards;
	}
	.stars {
		transform: var(--stars);
		animation: stars var(--tr-duration-slow) var(--tr-ease-emphasized) backwards;
	}
	polygon {
		stroke: var(--tr-color-ink);
		stroke-width: 2.5;
		stroke-linejoin: miter;
	}
	polygon.edge {
		stroke-width: 7;
	}
	.outline {
		stroke-width: 10;
		stroke-linejoin: round;
	}
	.ink {
		fill: var(--tr-color-ink);
	}
	.paper {
		fill: var(--tr-color-paper);
		stroke: none;
	}
	.stars polygon.paper {
		stroke: var(--tr-color-ink);
	}
	.grey {
		fill: color-mix(in srgb, var(--tr-color-paper) 60%, var(--tr-color-ink));
	}
	.light {
		fill: color-mix(in srgb, var(--tr-color-paper) 90%, var(--tr-color-ink));
	}
	.red {
		fill: var(--tr-color-accent);
	}
	.dots {
		fill: url(#menu-dots);
		stroke: none;
	}
	rect.paper {
		stroke: none;
	}

	@keyframes card {
		from {
			transform: translateX(-30%) rotate(-12deg);
			opacity: 0;
		}
	}
	@keyframes slash {
		from {
			transform: scale(1.5) rotate(-20deg);
			opacity: 0;
		}
	}
	@keyframes body {
		from {
			transform: translateY(40%);
		}
	}
	@keyframes stars {
		from {
			transform: translateX(40%) rotate(-20deg) scale(1.1);
		}
	}
</style>
