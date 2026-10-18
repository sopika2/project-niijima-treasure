import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * Layer boundaries. Each layer may only import what sits below it:
 *
 *   style.yml ─► ui ─► app ─► core ◄─ db
 *                 ▲             ▲
 *           extensions ─► stats-sdk
 *
 * Breaking a rule here fails `pnpm lint`, so shortcuts can't slowly erode the split.
 */
const framework = ['svelte', 'svelte/*', '@sveltejs/*', '$app/*', '#lib', '#lib/*'];
const storage = ['@treasure/db', 'drizzle-orm', 'drizzle-orm/*', 'better-sqlite3'];
const nodeIo = [
	'node:fs',
	'node:fs/*',
	'fs',
	'fs/*',
	'node:child_process',
	'node:net',
	'node:http',
	'node:https'
];

/** @param {string[]} patterns @param {string} message */
const forbid = (patterns, message) => ({
	'no-restricted-imports': ['error', { patterns: [{ group: [...new Set(patterns)], message }] }]
});

export default defineConfig(
	{
		ignores: [
			'**/node_modules/**',
			'**/build/**',
			'**/.svelte-kit/**',
			'packages/db/migrations/**',
			'data/**',
			'drive-dev/**'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: ['packages/core/**'],
		rules: forbid(
			['@treasure/*', ...framework, ...storage, ...nodeIo],
			'core is pure logic: no framework, no storage, no file or network access.'
		)
	},
	{
		files: ['packages/style/**'],
		rules: forbid(['@treasure/*', ...framework, ...storage], 'style depends on nothing internal.')
	},
	{
		files: ['packages/style/src/schema.ts', 'packages/style/src/compile.ts'],
		rules: forbid(
			['@treasure/*', ...framework, ...storage, ...nodeIo],
			'The style compiler is pure: it turns style.yml text into tokens and CSS.'
		)
	},
	{
		files: ['packages/stats-sdk/**'],
		rules: forbid(
			['@treasure/db', '@treasure/ui', '@treasure/style', ...framework, ...storage, ...nodeIo],
			'stats-sdk only describes read-only data shapes for extensions.'
		)
	},
	{
		files: ['packages/ui/**'],
		rules: forbid(
			['@treasure/db', '@treasure/stats-sdk', '$app/*', '#lib', '#lib/*', ...storage, ...nodeIo],
			'ui is presentation only: no data access. It gets everything through props and style.yml.'
		)
	},
	{
		files: ['packages/db/**'],
		rules: forbid(
			['@treasure/ui', '@treasure/style', '@treasure/stats-sdk', ...framework],
			'db stores data; it knows nothing about screens or styling.'
		)
	},
	{
		files: ['extensions/**'],
		rules: forbid(
			['@treasure/db', '@treasure/style', '$app/*', '#lib', '#lib/*', ...storage, ...nodeIo],
			'Extensions read data only through @treasure/stats-sdk and draw with @treasure/ui.'
		)
	}
);
