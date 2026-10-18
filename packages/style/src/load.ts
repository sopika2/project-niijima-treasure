import { createHash } from 'node:crypto';
import { existsSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';
import { compileStyle, type CompiledStyle } from './compile.ts';

export interface LoadedStyle extends CompiledStyle {
	/** Short content hash of the CSS, for cache-busting the stylesheet URL. */
	readonly hash: string;
	/** Where the style came from: the user's file, or the built-in default if none was found. */
	readonly source: string;
	readonly loadedAt: Date;
}

/** Reads and compiles a style file. Falls back to the default file when `path` doesn't exist. */
export function loadStyle(path: string, defaultPath: string): LoadedStyle {
	const defaults = readFileSync(defaultPath, 'utf8');
	const useDefault = !existsSync(path);
	const source = useDefault ? defaultPath : path;
	const text = useDefault ? defaults : readFileSync(path, 'utf8');
	const compiled = compileStyle({ text, defaults, file: basename(source) });
	const hash = createHash('sha256').update(compiled.css).digest('hex').slice(0, 12);
	return { ...compiled, hash, source, loadedAt: new Date() };
}

export interface StyleWatcher {
	current(): LoadedStyle;
	/** The last error from an edit that was rejected, if the file is currently invalid. */
	lastError(): string | null;
	close(): void;
}

/**
 * Loads a style and reloads it whenever the file changes. An invalid edit is rejected and
 * logged; the last good style stays in use until the file is fixed. If the file is already
 * invalid at startup, the built-in default is used until it is fixed.
 */
export function watchStyle(
	path: string,
	defaultPath: string,
	log: (message: string) => void = console.log
): StyleWatcher {
	let current: LoadedStyle;
	let error: string | null = null;
	try {
		current = loadStyle(path, defaultPath);
	} catch (problem) {
		error = problem instanceof Error ? problem.message : String(problem);
		log(`style: ${path} has errors, using the built-in style until it is fixed.\n${error}`);
		current = loadStyle(defaultPath, defaultPath);
	}
	let watcher: FSWatcher | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const reload = () => {
		try {
			const next = loadStyle(path, defaultPath);
			if (next.hash !== current.hash) log(`style: reloaded ${next.source} (${next.hash})`);
			current = next;
			error = null;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : String(problem);
			log(`style: kept the previous style because the edit has errors.\n${error}`);
		}
	};

	// Watch the folder, not the file: many editors save by replacing the file, which would
	// silently end a watch on the file itself. Changes are debounced and the file re-read.
	if (existsSync(dirname(path))) {
		try {
			const name = basename(path);
			watcher = watch(dirname(path), (_event, changed) => {
				if (changed !== null && changed !== name) return;
				if (timer) clearTimeout(timer);
				timer = setTimeout(reload, 150);
			});
			watcher.on('error', () => undefined);
		} catch {
			watcher = null;
		}
	}

	return {
		current: () => current,
		lastError: () => error,
		close: () => {
			if (timer) clearTimeout(timer);
			watcher?.close();
		}
	};
}
