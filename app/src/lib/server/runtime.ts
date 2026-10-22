import {
	ACCESS_MODE,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	DISCORD_WEBHOOK_URL,
	PUBLIC_URL,
	SESSION_DOMAIN,
	SESSION_SECRET,
	SNAPSHOT_KEY,
	SUMMARY_TOKEN,
	TREASURE_CONFIG,
	TREASURE_DATA,
	TREASURE_DRIVE,
	TREASURE_MIGRATIONS,
	TREASURE_STYLE,
	TREASURE_STYLE_DEFAULT
} from '$app/env/private';
import { defaultConfig, parseConfig, type Config } from '@treasure/core';
import {
	checkDrive,
	DriveUnavailableError,
	openDatabase,
	ratesFreshness,
	currenciesWithoutRates,
	restoreIfMissing,
	seedCategories,
	snapshotKeyFrom,
	type SnapshotKey,
	type Treasury
} from '@treasure/db';
import { watchStyle, type StyleWatcher } from '@treasure/style/load';
import { Cron } from 'croner';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { accessOff, discordAccess, type AccessGate } from './access.ts';
import {
	enabledExtensions,
	installedExtensions,
	type EnabledExtension,
	type InstalledExtension
} from './extensions.ts';
import { log, logError } from './log.ts';
import { writeDriveExports } from './exports.ts';
import { RateService } from './rates.ts';
import { postDueItems } from './recurring.ts';
import { SnapshotService } from './snapshots.ts';
import { notifyDiscord } from './verdicts.ts';

export interface Problem {
	readonly tone: 'warning' | 'danger' | 'info';
	readonly title: string;
	readonly detail: string;
}

export interface Runtime {
	readonly version: string;
	readonly startedAt: Date;
	readonly config: Config;
	readonly paths: {
		readonly config: string;
		readonly style: string;
		readonly styleDefault: string;
		readonly database: string;
		readonly drive: string;
	};
	readonly style: StyleWatcher;
	readonly treasury: Treasury;
	readonly snapshots: SnapshotService;
	readonly rates: RateService;
	/** When the newest exchange rate was fetched. */
	ratesAsOf(): string | null;
	readonly webhook: string | null;
	readonly access: AccessGate;
	readonly summaryToken: string | null;
	readonly installed: Map<string, InstalledExtension>;
	readonly extensions: readonly EnabledExtension[];
	/** Things worth a banner: a broken style.yml, backups switched off, sign-in off. */
	problems(): Problem[];
}

declare const __TREASURE_VERSION__: string;

const KEY = Symbol.for('niijima-treasury.runtime');
type Holder = { [KEY]?: Promise<Runtime> };

/** The booted app. Only valid after the server's init hook has run. */
export function runtime(): Promise<Runtime> {
	const holder = globalThis as Holder;
	holder[KEY] ??= boot();
	return holder[KEY];
}

function readConfig(path: string): { config: Config; text: string } {
	if (!existsSync(path)) {
		log(
			'config',
			`${path} not found; using defaults. Copy config.example.yml to config.yml to change them.`
		);
		return { config: defaultConfig(), text: '' };
	}
	const text = readFileSync(path, 'utf8');
	return { config: parseConfig(text, 'config.yml'), text };
}

async function snapshotKey(
	config: Config
): Promise<{ key: SnapshotKey | null; off: string | null }> {
	if (SNAPSHOT_KEY) return { key: await snapshotKeyFrom(SNAPSHOT_KEY), off: null };
	if (config.snapshots.encrypt) {
		return {
			key: null,
			off: 'SNAPSHOT_KEY is not set, so nothing is being saved to Drive. Create a key with "pnpm keygen" and add it to .env.'
		};
	}
	return { key: null, off: null };
}

function accessGate(config: Config): AccessGate {
	if (ACCESS_MODE === 'off') return accessOff();
	const missing = Object.entries({
		DISCORD_CLIENT_ID,
		DISCORD_CLIENT_SECRET,
		SESSION_SECRET,
		PUBLIC_URL
	})
		.filter(([, value]) => !value)
		.map(([name]) => name);
	if (missing.length > 0) {
		throw new Error(
			`Discord sign-in needs ${missing.join(', ')} in .env (see README), ` +
				'or ACCESS_MODE=off for local development only.'
		);
	}
	if ((SESSION_SECRET ?? '').length < 32) {
		throw new Error('SESSION_SECRET must be at least 32 characters (openssl rand -hex 32).');
	}
	if (config.access.discord_user_ids.length === 0) {
		log(
			'boot',
			'No Discord accounts are allowed yet. Sign in once: the page shows your Discord id to add to config.yml.'
		);
	}
	return discordAccess({
		app: {
			clientId: DISCORD_CLIENT_ID!,
			clientSecret: DISCORD_CLIENT_SECRET!,
			redirectUri: `${PUBLIC_URL!.replace(/\/+$/, '')}/auth/callback`
		},
		sessionSecret: SESSION_SECRET!,
		allowedIds: config.access.discord_user_ids,
		domain: SESSION_DOMAIN
	});
}

async function boot(): Promise<Runtime> {
	const version = typeof __TREASURE_VERSION__ === 'string' ? __TREASURE_VERSION__ : 'dev';
	log('boot', `Niijima Treasury ${version} starting`);

	const configPath = resolve(TREASURE_CONFIG);
	const { config, text: configText } = readConfig(configPath);

	const stylePath = resolve(TREASURE_STYLE);
	const styleDefault = resolve(TREASURE_STYLE_DEFAULT ?? TREASURE_STYLE);
	const style = watchStyle(stylePath, styleDefault, (message) => log('style', message));

	const access = accessGate(config);
	const installed = installedExtensions();
	const extensions = enabledExtensions(installed, config.extensions);

	const dataDir = resolve(TREASURE_DATA);
	const database = join(dataDir, 'treasury.db');
	const drive = resolve(TREASURE_DRIVE ?? config.drive_path);
	const { key, off } = await snapshotKey(config);

	// Restore from Drive before opening, if this server has no database yet.
	try {
		const restored = await restoreIfMissing({ dbPath: database, driveDir: drive, key });
		log('boot', `database: ${restored.reason}`);
	} catch (error) {
		if (!(error instanceof DriveUnavailableError)) throw error;
		log('boot', `${error.message} Starting with an empty database; it will not overwrite Drive.`);
	}

	const treasury = openDatabase({ path: database, migrationsFolder: resolve(TREASURE_MIGRATIONS) });
	const seeded = seedCategories(treasury.db);
	if (seeded > 0) log('boot', `added ${seeded} starting categories`);
	const snapshots = new SnapshotService({
		treasury,
		driveDir: drive,
		workDir: join(dataDir, 'tmp'),
		key,
		disabledReason: off,
		delayMinutes: config.snapshots.delay_minutes,
		keep: { daily: config.snapshots.keep_daily, monthly: config.snapshots.keep_monthly },
		timezone: config.timezone,
		appVersion: version,
		// Your settings and look travel with the snapshots, so a new server needs nothing else.
		extras: (): Record<string, string> => {
			const files: Record<string, string> = {};
			if (configText) files['config.yml'] = configText;
			if (existsSync(stylePath)) files['style.yml'] = readFileSync(stylePath, 'utf8');
			return files;
		}
	});
	snapshots.start();

	const rates = new RateService({
		treasury,
		base: config.base_currency,
		timezone: config.timezone,
		primary: config.rates.primary,
		fallback: config.rates.fallback,
		enabled: config.rates.enabled
	});

	// The app's own clock: everything that happens without you clicking anything.
	const jobs: Cron[] = [];
	const [hour, minute] = config.snapshots.nightly_at.split(':').map(Number);
	const webhook = DISCORD_WEBHOOK_URL ?? null;
	let self: Runtime | null = null;
	const withApp = (run: (app: Runtime) => unknown) => async () => {
		if (!self) return;
		try {
			await run(self);
		} catch (error) {
			logError('jobs', error);
		}
	};
	jobs.push(
		new Cron(
			`${minute} ${hour} * * *`,
			{ timezone: config.timezone, protect: true, name: 'nightly' },
			async () => {
				if (self) writeDriveExports(self);
				await snapshots.nightly();
			}
		),
		new Cron(
			config.rates.schedule,
			{ timezone: config.timezone, protect: true, name: 'rates' },
			async () => {
				await rates.refresh();
			}
		),
		// Every 15 minutes: post recurring items that came due, and tell Discord about new verdicts.
		new Cron(
			'*/15 * * * *',
			{ timezone: config.timezone, protect: true, name: 'quarter-hour' },
			withApp(async (app) => {
				postDueItems(app);
				await notifyDiscord(app, webhook);
			})
		)
	);

	process.once('sveltekit:shutdown', async () => {
		for (const job of jobs) job.stop();
		snapshots.stop();
		try {
			await snapshots.flush();
		} catch (error) {
			logError('shutdown', error);
		}
		style.close();
		treasury.close();
		log('boot', 'stopped');
	});

	const driveStatus = await checkDrive(drive);
	log(
		'boot',
		`ready · base ${config.base_currency} · drive ${driveStatus.reachable ? 'reachable' : 'NOT reachable'} at ${drive} · access ${access.mode} · extensions: ${extensions.map((extension) => extension.manifest.id).join(', ') || 'none'}`
	);
	if (access.mode === 'off')
		log('boot', 'No sign-in (ACCESS_MODE=off): anyone who can reach this app gets in.');

	const app: Runtime = {
		version,
		startedAt: new Date(),
		config,
		paths: { config: configPath, style: stylePath, styleDefault, database, drive },
		style,
		treasury,
		snapshots,
		rates,
		ratesAsOf: () => ratesFreshness(treasury.db),
		webhook,
		access,
		summaryToken: SUMMARY_TOKEN ?? null,
		installed,
		extensions,
		problems() {
			const list: Problem[] = [];
			const styleError = style.lastError();
			if (styleError) {
				list.push({
					tone: 'warning',
					title: 'style.yml has errors; the last good version is in use.',
					detail: styleError
				});
			}
			const snapshot = snapshots.status();
			if (snapshot.state === 'off' || snapshot.state === 'blocked') {
				list.push({
					tone: 'danger',
					title: 'Backups to Drive are not running.',
					detail: snapshot.problem ?? ''
				});
			}
			return list;
		}
	};

	self = app;
	postDueItems(app);
	// Fetch rates at start unless the stored ones are from the last six hours and cover every
	// currency in use.
	const newest = ratesFreshness(treasury.db);
	if (
		!newest ||
		Date.now() - Date.parse(newest) > 6 * 3_600_000 ||
		currenciesWithoutRates(treasury.db, config.base_currency).length > 0
	)
		void rates.refresh();
	return app;
}
