#!/usr/bin/env node
/**
 * Checks a style.yml without starting the app.
 *
 *   pnpm style:check                 checks ./style.yml
 *   pnpm style:check my-style.yml    checks another file
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStyle } from './load.ts';

const defaultPath = fileURLToPath(new URL('../../../style.yml', import.meta.url));
const target = resolve(process.argv[2] ?? 'style.yml');

if (!existsSync(target)) {
	console.error(`No file at ${target}`);
	process.exit(2);
}

try {
	const loaded = loadStyle(target, defaultPath);
	const { style, defaultsUsed } = loaded;
	console.log(`✓ ${target} is valid ("${style.meta.name}", ${style.colors.scheme} scheme).`);
	if (defaultsUsed.length > 0) {
		console.log(`  ${defaultsUsed.length} setting(s) not in the file use the built-in default:`);
		for (const path of defaultsUsed.slice(0, 20)) console.log(`    ${path}`);
		if (defaultsUsed.length > 20) console.log(`    …and ${defaultsUsed.length - 20} more`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
