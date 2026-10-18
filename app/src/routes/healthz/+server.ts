import { json } from '@sveltejs/kit';
import { runtime } from '#lib/server/runtime.ts';
import type { RequestHandler } from './$types';

/**
 * For the container health check. Answers 200 while the app and its database work, with
 * `status: "degraded"` when backups are not reaching Drive. Reveals no money data.
 */
export const GET: RequestHandler = async () => {
	const app = await runtime();
	let database = true;
	try {
		app.treasury.sqlite.prepare('SELECT 1').get();
	} catch {
		database = false;
	}
	const drive = await app.snapshots.drive();
	const snapshot = app.snapshots.status();
	const degraded =
		!drive.reachable || !drive.writable || snapshot.state === 'off' || snapshot.state === 'blocked';

	return json(
		{
			status: !database ? 'down' : degraded ? 'degraded' : 'ok',
			version: app.version,
			database,
			drive: { reachable: drive.reachable, writable: drive.writable },
			snapshot: { state: snapshot.state, last_saved_at: snapshot.lastSavedAt }
		},
		{ status: database ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
