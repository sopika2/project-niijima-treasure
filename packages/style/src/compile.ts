import { isMap, isScalar, LineCounter, parseDocument, type Document } from 'yaml';
import type { z } from 'zod';
import { styleSchema, type Style } from './schema.ts';

export interface CompiledStyle {
	/** The validated, fully filled-in style. */
	readonly style: Style;
	/** CSS custom properties for every visual token, for both color schemes. */
	readonly css: string;
	/** Settings the file left out, which fell back to the built-in default (dotted paths). */
	readonly defaultsUsed: readonly string[];
}

export class StyleError extends Error {
	readonly problems: readonly string[];
	constructor(file: string, problems: readonly string[]) {
		const count = problems.length === 1 ? 'a problem' : `${problems.length} problems`;
		super(`${file} has ${count}:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
		this.name = 'StyleError';
		this.problems = problems;
	}
}

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Overlays the user's values on the defaults. Objects merge key by key; lists and values replace. */
function overlay(base: unknown, top: unknown, path: string[], used: string[]): unknown {
	if (isPlain(base) && isPlain(top)) {
		const result: Plain = {};
		for (const key of new Set([...Object.keys(base), ...Object.keys(top)])) {
			if (!(key in top)) {
				collectLeaves(base[key], [...path, key], used);
				result[key] = base[key];
			} else if (!(key in base)) result[key] = top[key];
			else result[key] = overlay(base[key], top[key], [...path, key], used);
		}
		return result;
	}
	return top === undefined ? base : top;
}

function collectLeaves(value: unknown, path: string[], used: string[]): void {
	if (isPlain(value)) {
		for (const [key, inner] of Object.entries(value)) collectLeaves(inner, [...path, key], used);
	} else used.push(path.join('.'));
}

interface Located {
	readonly doc: Document;
	readonly lines: LineCounter;
}

function readYaml(text: string, file: string): Located & { value: unknown } {
	const lines = new LineCounter();
	const doc = parseDocument(text, { lineCounter: lines, prettyErrors: true });
	if (doc.errors.length > 0) {
		throw new StyleError(
			file,
			doc.errors.map((error) => error.message.split('\n')[0] ?? 'invalid YAML')
		);
	}
	const value = doc.toJS() ?? {};
	if (!isPlain(value)) throw new StyleError(file, ['the file must contain settings, not a list']);
	return { doc, lines, value };
}

/** Finds the line of a setting in the user's file, so errors point at it. */
function lineOf(where: Located, path: readonly PropertyKey[], key?: string): number | null {
	const keyPath = path.map((part) => (typeof part === 'symbol' ? String(part) : part));
	const node = keyPath.length ? where.doc.getIn(keyPath, true) : where.doc.contents;
	let offset: number | undefined;
	if (key !== undefined && isMap(node)) {
		const pair = node.items.find((item) => isScalar(item.key) && item.key.value === key);
		if (pair && isScalar(pair.key)) offset = pair.key.range?.[0];
	} else if (node && typeof node === 'object' && 'range' in node) {
		offset = (node as { range?: [number, number, number] }).range?.[0];
	}
	return offset === undefined ? null : where.lines.linePos(offset).line;
}

function describe(issue: z.core.$ZodIssue, where: Located): string[] {
	const at = (line: number | null) => (line ? `line ${line}: ` : '');
	const dotted = (extra?: string) =>
		[...issue.path, ...(extra ? [extra] : [])].map(String).join('.') || '(top level)';

	if (issue.code === 'unrecognized_keys') {
		return issue.keys.map(
			(key) =>
				`${at(lineOf(where, issue.path, key))}${dotted(key)} is not a setting (check the spelling)`
		);
	}
	if (issue.code === 'invalid_value' && 'values' in issue) {
		const options = issue.values.map(String).join(' | ');
		return [`${at(lineOf(where, issue.path))}${dotted()} must be one of: ${options}`];
	}
	return [`${at(lineOf(where, issue.path))}${dotted()}: ${issue.message}`];
}

const cssName = (...parts: string[]) => `--tr-${parts.join('-').replace(/_/g, '-')}`;

function declarations(entries: Array<[string, string | number]>, indent = '\t'): string {
	return entries.map(([name, value]) => `${indent}${name}: ${value};`).join('\n');
}

function colorBlock(palette: Style['colors']['dark']): Array<[string, string]> {
	return Object.entries(palette).map(([name, value]) => [cssName('color', name), value]);
}

function toCss(style: Style): string {
	const { typography: type, shape, motion, layout, charts, colors } = style;
	const density = layout.density === 'compact' ? 0.75 : 1;
	const spacing = Object.entries(shape.spacing).map(([name, value]): [string, string] => [
		cssName('space', name),
		density === 1 ? value : `calc(${value} * ${density})`
	]);
	const durations = Object.entries(motion.duration).map(([name, value]): [string, string] => [
		cssName('duration', name),
		motion.enabled ? value : '0ms'
	]);

	const base: Array<[string, string | number]> = [
		[cssName('font', 'body'), type.font_body],
		[cssName('font', 'heading'), type.font_heading],
		[cssName('font', 'numbers'), type.font_numbers],
		...type.font_ransom.map((value, index): [string, string] => [
			cssName('font', 'ransom', String(index + 1)),
			value
		]),
		[cssName('font', 'ransom', 'count'), String(type.font_ransom.length)],
		[cssName('font', 'size'), type.base_size],
		[cssName('line', 'height'), type.line_height],
		...Object.entries(type.size).map(([name, value]): [string, string] => [
			cssName('text', name),
			value
		]),
		...Object.entries(type.weight).map(([name, value]): [string, number] => [
			cssName('weight', name),
			value
		]),
		[cssName('heading', 'case'), type.heading_case],
		[cssName('heading', 'spacing'), type.heading_letter_spacing],
		[cssName('heading', 'style'), type.heading_italic ? 'italic' : 'normal'],
		[cssName('numeric'), type.tabular_numbers ? 'tabular-nums' : 'normal'],
		...spacing,
		...Object.entries(shape.radius).map(([name, value]): [string, string] => [
			cssName('radius', name),
			value
		]),
		[cssName('border', 'width'), shape.border_width],
		[cssName('accent', 'border', 'width'), shape.accent_border_width],
		[cssName('shadow', 'card'), shape.shadow.card],
		[cssName('shadow', 'raised'), shape.shadow.raised],
		[cssName('skew'), shape.skew],
		[cssName('cut'), shape.cut_corner],
		...durations,
		[cssName('ease', 'standard'), motion.easing.standard],
		[cssName('ease', 'emphasized'), motion.easing.emphasized],
		[cssName('max', 'width'), layout.max_width],
		[cssName('columns'), layout.dashboard_columns],
		...charts.palette.map((value, index): [string, string] => [
			cssName('chart', String(index + 1)),
			value
		]),
		[cssName('chart', 'line'), `${charts.line_width}px`],
		[cssName('chart', 'area', 'opacity'), charts.area_opacity]
	];

	const imports = type.import.map((url) => `@import url("${url}");`);
	const dark = declarations(colorBlock(colors.dark));
	const light = declarations(colorBlock(colors.light));
	const reduced = motion.respect_reduced_motion
		? `\n@media (prefers-reduced-motion: reduce) {\n\t:root {\n${declarations(
				Object.keys(motion.duration).map((name): [string, string] => [
					cssName('duration', name),
					'0ms'
				]),
				'\t\t'
			)}\n\t}\n}`
		: '';

	return [
		...imports,
		`/* Generated from style.yml (${style.meta.name}). Edit style.yml, not this output. */`,
		`:root {\n${declarations(base)}\n}`,
		`:root,\n:root[data-scheme='dark'] {\n\tcolor-scheme: dark;\n${dark}\n}`,
		`:root[data-scheme='light'] {\n\tcolor-scheme: light;\n${light}\n}`,
		`@media (prefers-color-scheme: light) {\n\t:root[data-scheme='auto'] {\n\t\tcolor-scheme: light;\n${declarations(colorBlock(colors.light), '\t\t')}\n\t}\n}`
	]
		.join('\n\n')
		.concat(reduced, '\n');
}

export interface CompileInput {
	/** The user's style.yml text. */
	readonly text: string;
	/** The built-in default style.yml text, used for anything the user's file leaves out. */
	readonly defaults: string;
	/** Name used in error messages. */
	readonly file?: string;
}

/** Validates style.yml against the schema and turns it into CSS. Throws StyleError with line numbers. */
export function compileStyle({ text, defaults, file = 'style.yml' }: CompileInput): CompiledStyle {
	const user = readYaml(text, file);
	const base = readYaml(defaults, 'default style.yml');
	const defaultsUsed: string[] = [];
	const merged = overlay(base.value, user.value, [], defaultsUsed);

	const result = styleSchema.safeParse(merged);
	if (!result.success) {
		throw new StyleError(
			file,
			result.error.issues.flatMap((issue) => describe(issue, user))
		);
	}
	return { style: result.data, css: toCss(result.data), defaultsUsed };
}

/** The data attributes the page's <html> element needs so layout choices in style.yml apply. */
export function htmlAttributes(style: Style): Record<string, string> {
	return {
		'data-scheme': style.colors.scheme,
		'data-title': style.typography.title_style,
		'data-texture': style.layout.texture,
		'data-sidebar': style.layout.sidebar,
		'data-transition': style.layout.page_transition,
		'data-card': style.layout.card_style,
		'data-density': style.layout.density,
		'data-motion': style.motion.enabled ? 'on' : 'off'
	};
}
