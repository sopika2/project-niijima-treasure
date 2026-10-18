import { parse as parseYaml, YAMLParseError } from 'yaml';
import { z } from 'zod';
import { isCurrencyCode } from './currency.ts';
import { describeIssues, InvalidFileError } from './issues.ts';

const currencyCode = z
	.string()
	.refine(isCurrencyCode, { message: 'must be a known 3-letter currency code, e.g. HUF or EUR' });

const clock = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'must be a 24-hour time like "03:30"' });

const span = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, {
	message: 'must be a time span like "23:00-08:00"'
});

const timezone = z.string().refine(
	(zone) => {
		try {
			new Intl.DateTimeFormat('en', { timeZone: zone });
			return true;
		} catch {
			return false;
		}
	},
	{ message: 'must be an IANA time zone such as Europe/Budapest' }
);

const extensionEntry = z.union([
	z.string().min(1),
	z.strictObject({ id: z.string().min(1), settings: z.record(z.string(), z.unknown()).default({}) })
]);

export const configSchema = z.strictObject({
	/** Currency every total and report is shown in. */
	base_currency: currencyCode.default('HUF'),
	/** Number and date formatting, e.g. hu-HU or en-GB. */
	locale: z.string().min(2).default('hu-HU'),
	timezone: timezone.default('Europe/Budapest'),
	/** Where the Google Drive folder is mounted inside the container. */
	drive_path: z.string().min(1).default('/app/drive'),
	snapshots: z
		.strictObject({
			/** Wait this long after the last change before writing a snapshot to Drive. */
			delay_minutes: z.number().int().min(1).max(120).default(2),
			/** Encrypt snapshots with the key in SNAPSHOT_KEY. Strongly recommended. */
			encrypt: z.boolean().default(true),
			keep_daily: z.number().int().min(1).max(365).default(14),
			keep_monthly: z.number().int().min(0).max(120).default(12),
			/** Local time for the nightly dated snapshot and exports. */
			nightly_at: clock.default('03:30')
		})
		.prefault({}),
	rates: z
		.strictObject({
			primary: z.enum(['otp', 'mnb']).default('otp'),
			fallback: z.enum(['otp', 'mnb', 'none']).default('mnb'),
			/** Cron schedule in local time. Default: every 2 hours 07-18 on weekdays. */
			schedule: z.string().min(9).default('0 7-18/2 * * 1-5')
		})
		.prefault({}),
	projection: z
		.strictObject({
			horizon_months: z.number().int().min(1).max(36).default(12),
			everyday_spending: z
				.discriminatedUnion('mode', [
					z.strictObject({
						mode: z.literal('average'),
						months: z.number().int().min(1).max(12).default(3)
					}),
					z.strictObject({ mode: z.literal('fixed'), per_month: z.number().nonnegative() })
				])
				.default({ mode: 'average', months: 3 })
		})
		.prefault({}),
	alerts: z
		.strictObject({
			/** Warn when the projected balance drops below this, in the base currency. */
			balance_floor: z.number().nonnegative().default(50000),
			budget_warn_percent: z.number().int().min(1).max(100).default(80),
			/** No Discord pings during this local time span. */
			quiet_hours: span.optional(),
			discord: z.boolean().default(true)
		})
		.prefault({}),
	access: z
		.strictObject({
			/** Discord accounts allowed to sign in, by user id. */
			discord_user_ids: z
				.array(
					z
						.union([z.string(), z.number()])
						.transform(String)
						.pipe(
							z
								.string()
								.regex(/^\d{15,21}$/, { message: 'must be a Discord user id (digits only)' })
						)
				)
				.default([])
		})
		.prefault({}),
	/** Enabled extensions. A name, or { id, settings }. */
	extensions: z.array(extensionEntry).default(['spending-this-month', 'status-card'])
});

export type ConfigInput = z.input<typeof configSchema>;
type ParsedConfig = z.output<typeof configSchema>;

export interface ExtensionSetting {
	readonly id: string;
	readonly settings: Readonly<Record<string, unknown>>;
}

export type Config = Omit<ParsedConfig, 'extensions'> & {
	readonly extensions: readonly ExtensionSetting[];
};

function normalize(parsed: ParsedConfig): Config {
	return {
		...parsed,
		extensions: parsed.extensions.map((entry) =>
			typeof entry === 'string' ? { id: entry, settings: {} } : entry
		)
	};
}

/**
 * YAML reads long ids (Discord's are 18-19 digits) as numbers, which would round them. Integers
 * are read exactly and turned back into numbers only when that is lossless; others stay text.
 */
function numbersFromYaml(value: unknown): unknown {
	if (typeof value === 'bigint') {
		return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
	}
	if (Array.isArray(value)) return value.map(numbersFromYaml);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, inner]) => [key, numbersFromYaml(inner)])
		);
	}
	return value;
}

/** Validates config.yml text. An empty file gives all defaults. */
export function parseConfig(text: string, file = 'config.yml'): Config {
	let raw: unknown;
	try {
		raw = numbersFromYaml(parseYaml(text, { intAsBigInt: true }) ?? {});
	} catch (error) {
		const detail = error instanceof YAMLParseError ? error.message : String(error);
		throw new InvalidFileError(file, `${file} is not valid YAML:\n  ${detail}`);
	}
	const result = configSchema.safeParse(raw);
	if (!result.success) throw new InvalidFileError(file, describeIssues(file, result.error.issues));
	return normalize(result.data);
}

export function defaultConfig(): Config {
	return parseConfig('');
}
