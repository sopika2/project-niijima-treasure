import { error } from '@sveltejs/kit';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { runtime } from '#lib/server/runtime.ts';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif',
	gif: 'image/gif'
};

/**
 * Character art for the command menu, read from the "art" folder in the Drive folder
 * (Niijima-network/Treasure/art), so images never have to live in git. Behind the same
 * sign-in as everything else.
 */
export const GET: RequestHandler = async ({ params }) => {
	const match = /^[\w.-]+\.(png|jpe?g|webp|avif|gif)$/i.exec(params.file);
	if (!match || params.file.startsWith('.')) error(404, 'Not found');
	const app = await runtime();
	const path = join(app.paths.drive, 'art', params.file);
	try {
		const [body, info] = await Promise.all([readFile(path), stat(path)]);
		return new Response(body, {
			headers: {
				'content-type': TYPES[match[1]!.toLowerCase()]!,
				'cache-control': 'private, max-age=3600',
				'last-modified': info.mtime.toUTCString()
			}
		});
	} catch {
		error(404, 'Not found');
	}
};
