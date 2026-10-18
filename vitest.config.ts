import { defineConfig } from 'vitest/config';

// Unit tests for the framework-free packages. The app has its own Vite/Vitest setup.
export default defineConfig({
	test: {
		include: ['packages/*/src/**/*.test.ts'],
		environment: 'node',
		expect: { requireAssertions: true }
	}
});
