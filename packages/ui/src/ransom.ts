/**
 * Cut-out letters the way Persona 5 sets its menus: each letter from one of the fonts in
 * typography.font_ransom, a little bigger or smaller, tilted, now and then in lower case, the
 * first letter of a word always from the first font and largest. Deterministic: the same text
 * always comes out the same way.
 */
export interface Letter {
	readonly char: string;
	/** A ready style="" value: --font, --weight, --scale, --lift, --turn, --tear, --i. */
	readonly style: string;
	readonly lower: boolean;
	/** 0–4, for components that want a few looks. */
	readonly pick: number;
}

function mix(text: string, index: number, salt: number): number {
	let h = (text.charCodeAt(index) || 7) * 131 + index * 977 + salt * 613 + text.length * 31;
	h = Math.imul(h ^ (h >>> 5), 2654435761) >>> 0;
	return h;
}

/** A torn scrap: each corner nudged a little, so the black paper behind a letter isn't a box. */
function tear(h: number): string {
	const n = (shift: number) => ((h >>> shift) % 9) - 4;
	return `polygon(${n(1) + 4}% ${n(3) + 5}%, ${96 + n(5)}% ${n(7) + 3}%, ${98 + n(9) / 2}% ${95 + n(11)}%, ${n(13) + 3}% ${97 + n(15) / 2}%)`;
}

export function ransom(text: string, salt = 0): Letter[] {
	return [...text].map((char, index) => {
		const h = mix(text, index, salt);
		const first = index === 0;
		const slot = first ? 1 : (h % 6) + 1;
		const font = (part: string) =>
			slot === 1
				? `var(--tr-font-ransom-1${part})`
				: `var(--tr-font-ransom-${slot}${part}, var(--tr-font-ransom-1${part}))`;
		const size = first ? 1.22 : 0.92 + ((h >>> 3) % 5) * 0.035;
		const lift = (((h >>> 7) % 5) - 2) * 0.03;
		const turn = (((h >>> 9) % 7) - 3) * 2.4; // up to ±7°, like the landing page's tiles
		const lower = !first && (h >>> 11) % 4 === 0 && /\p{L}/u.test(char);
		return {
			char,
			lower,
			pick: (h >>> 13) % 5,
			style:
				`--font:${font('')};--weight:${font('-weight')};` +
				`--scale:calc(${size.toFixed(3)} * ${font('-scale')});` +
				`--lift:${lift.toFixed(2)}em;--turn:${turn.toFixed(1)}deg;--tear:${tear(h)};--i:${index}`
		};
	});
}
