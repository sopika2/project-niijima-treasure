/**
 * Cut-out letters, Persona style: every letter gets its own font (from typography.font_ransom),
 * size, tilt and sometimes lower case. The same text always comes out the same way.
 */
export interface Letter {
	readonly char: string;
	/** A ready style="" string: --font, --scale, --lift, --turn, --i. */
	readonly style: string;
	readonly lower: boolean;
	/** 0–4, for components that want a few looks (chip colors). */
	readonly pick: number;
}

function seedOf(text: string, index: number, salt: number): number {
	const code = text.charCodeAt(index) || 0;
	return Math.abs((code * 31 + index * 17 + text.length * 7 + salt * 13) % 97);
}

export function ransom(text: string, salt = 0): Letter[] {
	return [...text].map((char, index) => {
		const seed = seedOf(text, index, salt);
		const first = index === 0;
		const font = first ? 1 : (seed % 6) + 1;
		const fallback = font === 1 ? '' : ', var(--tr-font-ransom-1)';
		const scale = first ? 1.3 : 0.84 + (seed % 5) * 0.07;
		const lift = ((seed % 7) - 3) * 0.04;
		const turn = ((seed % 9) - 4) * 1.1;
		const lower = !first && seed % 5 === 1 && /\p{L}/u.test(char);
		return {
			char,
			lower,
			pick: seed % 5,
			style: `--font:var(--tr-font-ransom-${font}${fallback});--scale:${scale.toFixed(2)};--lift:${lift.toFixed(2)}em;--turn:${turn.toFixed(1)}deg;--i:${index}`
		};
	});
}
