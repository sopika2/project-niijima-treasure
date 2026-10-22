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
			'"off" (default): no sign-in, anyone who can reach the app gets in (put Cloudflare Access in front). "discord": sign in with Discord.',
		schema: (value) => {
			const mode = optional(value) ?? 'off';
			if (mode !== 'discord' && mode !== 'off')
				throw new Error('ACCESS_MODE must be discord or off');
			return mode;
		}
	},
	DISCORD_CLIENT_ID: {
		description: 'OAuth2 Client ID of your Discord application.',
		schema: optional
	},
	DISCORD_CLIENT_SECRET: {
		description: 'OAuth2 Client Secret of your Discord application.',
		schema: optional
	},
	SESSION_SECRET: {
		description: 'Random string that signs login cookies (openssl rand -hex 32).',
		schema: optional
	},
	SESSION_DOMAIN: {
		description:
			'Parent domain (e.g. niijimasisters.com) to share sign-in with every Niijima app that has the same SESSION_SECRET. Empty: this app only.',
		schema: (value) => {
			const domain = optional(value)?.replace(/^\./, '');
			if (domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
				throw new Error('SESSION_DOMAIN must be a domain name like niijimasisters.com');
			}
			return domain;
		}
	},
	PUBLIC_URL: {
		description: 'The address people open, e.g. https://treasure.niijimasisters.com',
		schema: optional
	},
	DISCORD_WEBHOOK_URL: {
		description:
			'Discord webhook that receives Verdicts (Server Settings → Integrations → Webhooks). Leave empty for none.',
		schema: (value) => {
			const url = optional(value);
			if (url && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
				throw new Error('DISCORD_WEBHOOK_URL must be a https://discord.com/api/webhooks/… address');
			}
			return url;
		}
	},
	SUMMARY_TOKEN: {
		description: 'Token the homepage uses to read /api/summary. Leave empty to turn the feed off.',
		schema: optional
	}
});
