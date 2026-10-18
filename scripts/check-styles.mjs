#!/usr/bin/env node
/**
 * Keeps style.yml the only place looks are defined: fails if a component, page or extension
 * writes a literal color or font instead of using a var(--tr-…) variable from style.yml.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const folders = ['packages/ui/src', 'app/src', 'extensions'];
const skip = new Set(['node_modules', '.svelte-kit', 'build']);

const rules = [
	{ pattern: /#[0-9a-fA-F]{3,8}\b/, what: 'a hex color' },
	{ pattern: /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/, what: 'a color function' },
	{ pattern: /font-family:(?!\s*(var\(|inherit))/, what: 'a font that is not var(--tr-font-…)' }
];

function* files(folder) {
	for (const name of readdirSync(folder)) {
		if (skip.has(name)) continue;
		const path = join(folder, name);
		if (statSync(path).isDirectory()) yield* files(path);
		else if (/\.(svelte|css)$/.test(name)) yield path;
	}
}

/** Only the styling parts: <style> blocks in .svelte files, all of a .css file, and style="" attributes. */
function styling(path, text) {
	if (path.endsWith('.css')) return text;
	const blocks = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
	const inline = [...text.matchAll(/\sstyle="([^"]*)"/g)].map((match) => match[1]);
	return [...blocks, ...inline].join('\n');
}

const problems = [];
for (const folder of folders) {
	for (const path of files(join(root, folder))) {
		const text = styling(path, readFileSync(path, 'utf8'));
		text.split('\n').forEach((line, index) => {
			for (const rule of rules) {
				if (rule.pattern.test(line)) {
					problems.push(
						`${relative(root, path)}: ${rule.what} in "${line.trim()}" (style block line ${index + 1})`
					);
				}
			}
		});
	}
}

if (problems.length > 0) {
	console.error('Looks must come from style.yml. Use var(--tr-…) instead of:\n');
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}
console.log('✓ No hard-coded colors or fonts outside style.yml.');
