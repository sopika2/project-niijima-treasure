import { z } from 'zod';

// Values end up inside CSS, so none of them may contain characters that could end a declaration.
const UNSAFE = /[;{}<>\\]/;
const safe = (message: string) => (value: string) => !UNSAFE.test(value) || message;

function cssText(what: string, pattern: RegExp, example: string) {
	return z.string().superRefine((value, ctx) => {
		const unsafe = safe(`${what} cannot contain ; { } < > or \\`)(value);
		if (unsafe !== true) ctx.addIssue({ code: 'custom', message: unsafe });
		else if (!pattern.test(value.trim())) {
			ctx.addIssue({ code: 'custom', message: `"${value}" is not a ${what}, e.g. ${example}` });
		}
	});
}

const COLOR =
	/^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(.+\))$/;
const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em|%|vw|vh|ch|ex))$/;
const DURATION = /^\d*\.?\d+(ms|s)$/;
const ANGLE = /^-?\d*\.?\d+deg$/;
const EASING =
	/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)|steps\(.+\)|linear\(.+\))$/;
const FONT_STACK = /^[\w\s"',-]+$/;
const SHADOW = /^(none|[\w\s#().,%-]+)$/;
const ASSET = /^\/[\w./-]+$/;

export const color = cssText('color', COLOR, '"#e5243b" or "oklch(62% 0.22 25)"');
export const length = cssText('size', LENGTH, '16px or 1.25rem');
const duration = cssText('duration', DURATION, '220ms or 0.4s');
const angle = cssText('angle', ANGLE, '-8deg');
const easing = cssText('timing function', EASING, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
const fontStack = cssText('font list', FONT_STACK, '"Inter", system-ui, sans-serif');
const shadow = cssText('shadow', SHADOW, '"0 12px 32px #00000066" or none');
const words = z.string().min(1).max(200);
const asset = z
	.string()
	.regex(ASSET, { message: 'must be a path starting with /, e.g. /favicon.svg' })
	.nullable();
const stylesheetUrl = z
	.url({ protocol: /^https$/, message: 'must be an https:// stylesheet URL' })
	.refine((value) => !UNSAFE.test(value) && !value.includes('"'), {
		message: 'URL contains characters that are not allowed'
	});

const palette = z.strictObject({
	background: color,
	surface: color,
	surface_raised: color,
	border: color,
	text: color,
	text_muted: color,
	accent: color,
	accent_text: color,
	secondary: color,
	secondary_text: color,
	income: color,
	expense: color,
	success: color,
	warning: color,
	danger: color,
	focus_ring: color,
	overlay: color
});

export const styleSchema = z.strictObject({
	meta: z.strictObject({ name: words }),
	colors: z.strictObject({
		scheme: z.enum(['dark', 'light', 'auto']),
		dark: palette,
		light: palette
	}),
	typography: z.strictObject({
		import: z.array(stylesheetUrl).max(4),
		font_body: fontStack,
		font_heading: fontStack,
		font_numbers: fontStack,
		base_size: length,
		line_height: z.number().min(1).max(2.5),
		size: z.strictObject({
			xs: length,
			sm: length,
			md: length,
			lg: length,
			xl: length,
			xxl: length
		}),
		weight: z.strictObject({
			regular: z.number().int().min(100).max(1000),
			medium: z.number().int().min(100).max(1000),
			bold: z.number().int().min(100).max(1000),
			heading: z.number().int().min(100).max(1000)
		}),
		heading_case: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']),
		heading_letter_spacing: length,
		heading_italic: z.boolean(),
		tabular_numbers: z.boolean()
	}),
	shape: z.strictObject({
		spacing: z.strictObject({ xs: length, sm: length, md: length, lg: length, xl: length }),
		radius: z.strictObject({ sm: length, md: length, lg: length, pill: length }),
		border_width: length,
		accent_border_width: length,
		shadow: z.strictObject({ card: shadow, raised: shadow }),
		skew: angle,
		cut_corner: length
	}),
	motion: z.strictObject({
		enabled: z.boolean(),
		respect_reduced_motion: z.boolean(),
		duration: z.strictObject({ fast: duration, normal: duration, slow: duration }),
		easing: z.strictObject({ standard: easing, emphasized: easing })
	}),
	layout: z.strictObject({
		max_width: length,
		density: z.enum(['comfortable', 'compact']),
		nav_desktop: z.enum(['sidebar', 'top']),
		nav_mobile: z.enum(['bottom', 'top']),
		card_style: z.enum(['flat', 'outlined', 'elevated', 'cut']),
		dashboard_columns: z.number().int().min(1).max(4),
		dashboard_order: z.array(z.string().min(1))
	}),
	charts: z.strictObject({
		palette: z.array(color).min(2).max(16),
		line_width: z.number().min(0.5).max(8),
		curve: z.enum(['linear', 'monotone', 'step']),
		grid: z.boolean(),
		points: z.boolean(),
		area_opacity: z.number().min(0).max(1),
		tooltip: z.enum(['card', 'minimal'])
	}),
	copy: z.strictObject({
		app_name: words,
		app_short_name: words,
		tagline: words,
		nav: z.strictObject({
			dashboard: words,
			transactions: words,
			recurring: words,
			budgets: words,
			goals: words,
			reports: words,
			system: words
		}),
		terms: z.strictObject({
			balance: words,
			total: words,
			income: words,
			expense: words,
			transfer: words,
			projected: words,
			goal: words,
			goals: words,
			alert: words,
			alerts: words,
			account: words,
			accounts: words
		}),
		actions: z.strictObject({ quick_add: words, save: words, cancel: words, snapshot_now: words }),
		empty: z.strictObject({ dashboard: words, widgets: words }),
		labels: z.strictObject({ backup: words, drive: words, rates: words }),
		system: z.strictObject({
			database: words,
			style: words,
			config: words,
			state: words,
			name: words,
			locale: words,
			last_saved: words,
			never: words,
			generation: words,
			encryption: words,
			encrypted: words,
			not_encrypted: words,
			nightly: words,
			file: words,
			size: words,
			instance: words,
			source: words,
			defaults_used: words,
			base_currency: words,
			timezone: words,
			extensions: words,
			access: words,
			access_on: words,
			access_off: words,
			snapshot_taken: words,
			snapshot_failed: words
		}),
		status: z.strictObject({
			healthy: words,
			degraded: words,
			snapshot_ok: words,
			snapshot_pending: words,
			snapshot_never: words,
			drive_ok: words,
			drive_missing: words,
			rates_ok: words,
			rates_never: words,
			missing_rates: words
		})
	}),
	assets: z.strictObject({ favicon: asset, logo: asset })
});

export type Style = z.output<typeof styleSchema>;
export type ColorName = keyof Style['colors']['dark'];
