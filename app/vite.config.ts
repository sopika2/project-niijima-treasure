import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export default defineConfig(({ command }) => ({
	define: {
		__TREASURE_VERSION__: JSON.stringify(version)
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	// For the production build, bundle every dependency into the server so the container only
	// needs node_modules for the one native module. In development Vite loads them normally.
	ssr: command === 'build' ? { noExternal: true, external: ['better-sqlite3'] } : {},
	test: {
		expect: { requireAssertions: true },
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
}));
