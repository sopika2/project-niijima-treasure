import { copyFileSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { watchStyle, type StyleWatcher } from './load.ts';

const shipped = new URL('../../../style.yml', import.meta.url).pathname;
const quiet = () => undefined;
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
let watcher: StyleWatcher | null = null;

afterEach(() => watcher?.close());

function folder() {
	const dir = mkdtempSync(join(tmpdir(), 'style-'));
	const path = join(dir, 'style.yml');
	copyFileSync(shipped, path);
	return path;
}

describe('watchStyle', () => {
	it('picks up edits, including editors that save by replacing the file', async () => {
		const path = folder();
		watcher = watchStyle(path, shipped, quiet);
		expect(watcher.current().style.colors.dark.accent).toBe('#d90416');

		writeFileSync(path, 'colors:\n  dark:\n    accent: "#00aa55"\n');
		await settle();
		expect(watcher.current().style.colors.dark.accent).toBe('#00aa55');

		const replacement = `${path}.tmp`;
		writeFileSync(replacement, 'colors:\n  dark:\n    accent: "#123456"\n');
		renameSync(replacement, path);
		await settle();
		expect(watcher.current().style.colors.dark.accent).toBe('#123456');
	});

	it('keeps the last good style when an edit is invalid', async () => {
		const path = folder();
		watcher = watchStyle(path, shipped, quiet);
		writeFileSync(path, 'colors:\n  dark:\n    accent: nope\n');
		await settle();
		expect(watcher.current().style.colors.dark.accent).toBe('#d90416');
		expect(watcher.lastError()).toMatch(/line 3: colors\.dark\.accent/);

		writeFileSync(path, readFileSync(shipped, 'utf8'));
		await settle();
		expect(watcher.lastError()).toBeNull();
	});

	it('starts with the built-in style when the file is broken at startup', () => {
		const path = folder();
		writeFileSync(path, 'layout:\n  card_style: wavy\n');
		watcher = watchStyle(path, shipped, quiet);
		expect(watcher.current().style.layout.card_style).toBe('cut');
		expect(watcher.lastError()).toMatch(/card_style must be one of/);
	});
});
