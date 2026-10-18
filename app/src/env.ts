import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) =>
	value === undefined || value === '' ? undefined : value;
const withDefault = (fallback: string) => (value: string | undefined) =>
	optional(value) ?? fallback;

export const variables = defineEnvVars({
	TREASURE_CONFIG: {
		description: 'Path to config.yml.',
		schema: withDefault('config.yml')
	},
	TREASURE_STYLE: {
		description: 'Path to your style.yml.',
		schema: withDefault('style.yml')
	},
	TREASURE_STYLE_DEFAULT: {
		description: 'Path to the built-in style.yml used for anything your style.yml leaves out.',
		schema: optional
	},
	TREASURE_DATA: {
		description: 'Folder for the live database and temporary files (local disk, not Drive).',
		schema: withDefault('data')
	},
	TREASURE_MIGRATIONS: {
		description: 'Folder with the SQL migrations.',
		schema: withDefault('migrations')
	},
	TREASURE_DRIVE: {
		description: 'Overrides drive_path from config.yml (handy in development).',
		schema: optional
	},
	SNAPSHOT_KEY: {
		description:
			'age secret key (AGE-SECRET-KEY-1…) used to encrypt snapshots. Create with: pnpm keygen',
		schema: optional
	},
	ACCESS_MODE: {
		description:
			'"cloudflare" checks the Cloudflare Access login on every request; "off" is for local development only.',
		schema: (value) => {
			const mode = optional(value) ?? 'cloudflare';
			if (mode !== 'cloudflare' && mode !== 'off')
				throw new Error('ACCESS_MODE must be cloudflare or off');
			return mode;
		}
	},
	CF_ACCESS_TEAM_DOMAIN: {
		description: 'Your Cloudflare Access team domain, e.g. niijima.cloudflareaccess.com',
		schema: optional
	},
	CF_ACCESS_AUD: {
		description: 'The Application Audience (AUD) tag of the Access application.',
		schema: optional
	},
	SUMMARY_TOKEN: {
		description: 'Token the homepage uses to read /api/summary. Leave empty to turn the feed off.',
		schema: optional
	}
});
