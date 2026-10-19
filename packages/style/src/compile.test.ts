import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileStyle, htmlAttributes, StyleError } from './compile.ts';

const defaults = readFileSync(new URL('../../../style.yml', import.meta.url), 'utf8');
const compile = (text: string) => compileStyle({ text, defaults });

function problems(text: string): readonly string[] {
	try {
		compile(text);
	} catch (error) {
		if (error instanceof StyleError) return error.problems;
		throw error;
	}
	throw new Error('expected the style to be rejected');
}

describe('compileStyle', () => {
	it('accepts the shipped style.yml as-is and uses no defaults', () => {
		const result = compile(defaults);
		expect(result.style.copy.app_name).toBe('Niijima Treasury');
		expect(result.defaultsUsed).toEqual([]);
	});

	it('emits CSS variables for both schemes', () => {
		const { css } = compile(defaults);
		expect(css).toContain('--tr-color-accent: #e8132b;');
		expect(css).toContain(":root[data-scheme='light']");
		expect(css).toContain('--tr-color-accent: #d10f25;');
		expect(css).toContain('--tr-skew: -10deg;');
		expect(css).toContain('--tr-chart-1: #e66767;');
		expect(css).toContain('prefers-reduced-motion');
	});

	it('fills anything left out from the defaults and lists it', () => {
		const result = compile('colors:\n  dark:\n    accent: "#00ff88"\n');
		expect(result.style.colors.dark.accent).toBe('#00ff88');
		expect(result.style.colors.dark.secondary).toBe('#3f7ce8');
		expect(result.defaultsUsed).toContain('colors.dark.secondary');
		expect(result.defaultsUsed).not.toContain('colors.dark.accent');
	});

	it('replaces lists instead of merging them', () => {
		const result = compile('charts:\n  palette: ["#111111", "#222222"]\n');
		expect(result.style.charts.palette).toEqual(['#111111', '#222222']);
	});

	it('points typos at their line', () => {
		expect(problems('meta:\n  name: Test\ncolors:\n  dark:\n    acent: "#fff"\n')).toEqual([
			'line 5: colors.dark.acent is not a setting (check the spelling)'
		]);
	});

	it('explains invalid values with an example', () => {
		const found = problems(
			'shape:\n  skew: 8\n  cut_corner: 14 px\ncolors:\n  dark:\n    text: blu\n'
		);
		expect(found.join('\n')).toMatch(/line 2: shape\.skew/);
		expect(found.join('\n')).toMatch(/line 3: shape\.cut_corner: "14 px" is not a size/);
		expect(found.join('\n')).toMatch(/line 6: colors\.dark\.text: "blu" is not a color/);
	});

	it('lists the allowed choices for a setting with options', () => {
		expect(problems('layout:\n  card_style: wavy\n')).toEqual([
			'line 2: layout.card_style must be one of: flat | outlined | elevated | cut'
		]);
	});

	it('refuses values that could break out of the stylesheet', () => {
		expect(problems('colors:\n  dark:\n    text: "red; } body { display: none"\n').join()).toMatch(
			/cannot contain/
		);
		expect(problems('typography:\n  import: ["http://example.com/font.css"]\n').join()).toMatch(
			/https/
		);
	});

	it('reports broken YAML', () => {
		expect(() => compile('colors: [\n')).toThrow(StyleError);
	});

	it('turns motion off by zeroing every duration', () => {
		const { css } = compile('motion:\n  enabled: false\n');
		expect(css).toContain('--tr-duration-normal: 0ms;');
	});

	it('shrinks spacing in compact density', () => {
		const { css } = compile('layout:\n  density: compact\n');
		expect(css).toContain('--tr-space-md: calc(16px * 0.75);');
	});

	it('gives the html element its layout attributes', () => {
		expect(htmlAttributes(compile(defaults).style)).toMatchObject({
			'data-scheme': 'dark',
			'data-card': 'cut',
			'data-title': 'ransom',
			'data-navigation': 'command',
			'data-transition': 'slash'
		});
	});

	it('numbers the ransom fonts', () => {
		const { css } = compile(defaults);
		expect(css).toContain('--tr-font-ransom-1: Fraunces, Georgia, serif;');
		expect(css).toContain('--tr-font-ransom-1-weight: 900;');
		expect(css).toContain('--tr-font-ransom-3-scale: 1.06;');
		expect(css).toContain('--tr-font-ransom-count: 6;');
	});
});
