/** Small, dependency-free helpers shared by the chart components. */

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type Curve = 'linear' | 'monotone' | 'step';

/** Maps a value from one range onto another. */
export function scale(domain: readonly [number, number], range: readonly [number, number]) {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const span = d1 - d0 || 1;
	return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** About `count` round tick values covering [min, max], always including the extended ends. */
export function niceTicks(min: number, max: number, count = 4): number[] {
	if (min === max) {
		const pad = Math.abs(min) * 0.1 || 1;
		min -= pad;
		max += pad;
	}
	const raw = (max - min) / count;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw) as number;
	const start = Math.floor(min / step) * step;
	const end = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let value = start; value <= end + step / 2; value += step)
		ticks.push(Math.round(value / step) * step);
	return ticks;
}

/** An SVG path through the points with the chosen curve. */
export function linePath(points: readonly Point[], curve: Curve): string {
	if (points.length === 0) return '';
	const [first] = points as [Point];
	if (points.length === 1) return `M${first.x},${first.y}`;
	if (curve === 'step') {
		let d = `M${first.x},${first.y}`;
		for (let i = 1; i < points.length; i += 1) {
			const p = points[i]!;
			d += `H${p.x}V${p.y}`;
		}
		return d;
	}
	if (curve === 'linear' || points.length < 3) {
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('');
	}
	// Monotone cubic (Fritsch–Carlson): smooth, but never overshoots between points.
	const n = points.length;
	const dx: number[] = [];
	const slope: number[] = [];
	for (let i = 0; i < n - 1; i += 1) {
		const a = points[i]!;
		const b = points[i + 1]!;
		dx.push(b.x - a.x);
		slope.push(b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x));
	}
	const tangent: number[] = [slope[0]!];
	for (let i = 1; i < n - 1; i += 1) {
		const s0 = slope[i - 1]!;
		const s1 = slope[i]!;
		tangent.push(
			s0 * s1 <= 0
				? 0
				: (3 * (dx[i - 1]! + dx[i]!)) /
						((2 * dx[i]! + dx[i - 1]!) / s0 + (dx[i]! + 2 * dx[i - 1]!) / s1)
		);
	}
	tangent.push(slope[n - 2]!);
	let d = `M${first.x},${first.y}`;
	for (let i = 0; i < n - 1; i += 1) {
		const a = points[i]!;
		const b = points[i + 1]!;
		const h = dx[i]! / 3;
		d += `C${a.x + h},${a.y + h * tangent[i]!} ${b.x - h},${b.y - h * tangent[i + 1]!} ${b.x},${b.y}`;
	}
	return d;
}

/** The line path closed down to `baseline`, for a filled area. */
export function areaPath(points: readonly Point[], curve: Curve, baseline: number): string {
	if (points.length < 2) return '';
	const first = points[0]!;
	const last = points[points.length - 1]!;
	return `${linePath(points, curve)}L${last.x},${baseline}L${first.x},${baseline}Z`;
}

/** Index of the point nearest to `x`. */
export function nearest(points: readonly Point[], x: number): number {
	let best = 0;
	for (let i = 1; i < points.length; i += 1) {
		if (Math.abs(points[i]!.x - x) < Math.abs(points[best]!.x - x)) best = i;
	}
	return best;
}

/** Short money for axis labels: 1.2M, 350k. */
export function compact(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
		value
	);
}
