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
// A bare 0 is a valid size, so accept it unquoted too.
export const length = z.preprocess(
	(value) => (value === 0 ? '0' : value),
	cssText('size', LENGTH, '16px or 1.25rem')
);
const duration = cssText('duration', DURATION, '220ms or 0.4s');
const angle = cssText('angle', ANGLE, '-8deg');
const easing = cssText('timing function', EASING, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
const fontStack = cssText('font list', FONT_STACK, '"Inter", system-ui, sans-serif');
const shadow = cssText('shadow', SHADOW, '"0 12px 32px #00000066" or none');
const words = z.string().min(1).max(200);

/** A group of words, every one required. Keeps the long copy section readable. */
function wordGroup<const K extends string>(...keys: K[]) {
	return z.strictObject(
		Object.fromEntries(keys.map((key) => [key, words])) as Record<K, typeof words>
	);
}
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
	overlay: color,
	/** The flip colors: selected items turn into ink on paper, like a highlighted menu entry. */
	paper: color,
	ink: color,
	/** The second shard of the menu cursor (cyan in Persona 5). */
	cursor: color
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
		/** Fonts the cut-out letters of titles and the menu are mixed from, in turn. */
		font_ransom: z.array(fontStack).min(1).max(6),
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
		tabular_numbers: z.boolean(),
		/** "ransom" sets page titles as cut-out letters, calling-card style; "plain" as normal text. */
		title_style: z.enum(['ransom', 'plain'])
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
		card_style: z.enum(['flat', 'outlined', 'elevated', 'cut']),
		dashboard_columns: z.number().int().min(1).max(4),
		dashboard_order: z.array(z.string().min(1)),
		/** Pattern behind the page. */
		texture: z.enum(['halftone', 'stripes', 'none']),
		/**
		 * "command": a slim top bar, and the full-screen Persona command menu opens from the Menu
		 * button or Esc. "sidebar": a menu always shown at the side on wide screens.
		 */
		navigation: z.enum(['command', 'sidebar']),
		/** With navigation: sidebar, its color: a solid accent slab, or the same as cards. */
		sidebar: z.enum(['accent', 'surface']),
		/** Page changes play a red/black slash wipe (only when motion is on). */
		page_transition: z.enum(['slash', 'none'])
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
		nav: wordGroup(
			'dashboard',
			'transactions',
			'accounts',
			'recurring',
			'budgets',
			'goals',
			'reports',
			'system',
			'menu',
			'menu_title',
			'menu_hint',
			'menu_heading',
			'confirm',
			'move'
		),
		/** The line under the big heading on the command menu, for the highlighted command. */
		nav_hints: wordGroup(
			'dashboard',
			'transactions',
			'accounts',
			'recurring',
			'budgets',
			'goals',
			'reports',
			'system'
		),
		terms: wordGroup(
			'balance',
			'total',
			'income',
			'expense',
			'transfer',
			'projected',
			'goal',
			'goals',
			'alert',
			'alerts',
			'account',
			'accounts'
		),
		actions: wordGroup(
			'quick_add',
			'add',
			'save',
			'cancel',
			'edit',
			'delete',
			'close',
			'snapshot_now',
			'sign_out'
		),
		empty: wordGroup('dashboard', 'widgets'),
		signin: wordGroup(
			'kicker',
			'title',
			'subtitle',
			'button',
			'note',
			'signed_out',
			'expired',
			'failed',
			'refused',
			'refused_help'
		),
		dashboard: wordGroup(
			'this_month',
			'net',
			'recent',
			'see_all',
			'no_activity',
			'add_account',
			'no_accounts',
			'spending',
			'other',
			'no_spending',
			'coming_up'
		),
		transactions: wordGroup(
			'title',
			'empty',
			'search',
			'all_accounts',
			'all_categories',
			'all_kinds',
			'uncategorized',
			'edit',
			'delete_confirm',
			'deleted',
			'saved',
			'previous_month',
			'next_month',
			'this_month',
			'filter'
		),
		accounts: wordGroup(
			'title',
			'subtitle',
			'new',
			'edit',
			'archive',
			'restore',
			'archived',
			'empty',
			'opening_balance',
			'opening_date',
			'include_in_total',
			'excluded',
			'currency_locked',
			'saved'
		),
		account_types: wordGroup('current', 'savings', 'cash', 'card', 'other'),
		categories: wordGroup(
			'title',
			'new',
			'income',
			'expense',
			'archive',
			'restore',
			'archived',
			'saved',
			'empty'
		),
		form: wordGroup(
			'kind',
			'amount',
			'received',
			'account',
			'from_account',
			'to_account',
			'category',
			'date',
			'note',
			'note_placeholder',
			'name',
			'type',
			'currency',
			'optional'
		),
		errors: wordGroup(
			'required',
			'invalid_amount',
			'not_positive',
			'invalid_date',
			'unknown_account',
			'archived_account',
			'unknown_category',
			'wrong_category',
			'same_account',
			'to_amount_required',
			'too_large',
			'name_taken',
			'not_found',
			'unknown_currency',
			'currency_locked',
			'recurring_cross_currency',
			'invalid_rate',
			'generic'
		),
		labels: wordGroup('backup', 'drive', 'rates'),
		recurring: wordGroup(
			'title',
			'subtitle',
			'new',
			'edit',
			'empty',
			'waiting',
			'waiting_hint',
			'confirm',
			'skip',
			'next_due',
			'ended',
			'paused',
			'pause',
			'resume',
			'delete',
			'delete_confirm',
			'auto_post',
			'auto_post_hint',
			'amount_varies',
			'amount_varies_hint',
			'every',
			'unit_daily',
			'unit_weekly',
			'unit_monthly',
			'unit_yearly',
			'day_of_month',
			'last_day',
			'starts',
			'ends',
			'per_month',
			'saved',
			'deleted',
			'confirmed',
			'skipped',
			'name_placeholder'
		),
		budgets: wordGroup(
			'title',
			'subtitle',
			'limit',
			'spent',
			'left',
			'over_by',
			'on_pace',
			'projected',
			'empty',
			'add',
			'remove',
			'saved',
			'removed',
			'pick_category',
			'month_total'
		),
		treasures: wordGroup(
			'title',
			'subtitle',
			'new',
			'edit',
			'target',
			'saved',
			'deadline',
			'linked_account',
			'not_linked',
			'linked_hint',
			'put_in',
			'put_in_hint',
			'needed',
			'eta',
			'reached',
			'late',
			'no_pace',
			'empty',
			'archive',
			'restore',
			'archived',
			'saved_msg',
			'contribution_saved'
		),
		verdicts: wordGroup(
			'title',
			'none',
			'budget_over',
			'budget_warn',
			'budget_pace',
			'balance_floor',
			'pending',
			'goal_late',
			'rates_failed',
			'rates_stale',
			'backup'
		),
		projection: wordGroup(
			'title',
			'lowest',
			'month_end',
			'horizon_end',
			'basis_average',
			'basis_fixed',
			'what_if',
			'what_if_hint',
			'what_if_amount',
			'what_if_date',
			'what_if_apply',
			'what_if_clear',
			'today',
			'balance_on',
			'range_1m',
			'range_3m',
			'range_all'
		),
		reports: wordGroup(
			'title',
			'subtitle',
			'months_6',
			'months_12',
			'income_vs_spending',
			'net_worth',
			'categories',
			'export',
			'export_csv',
			'export_json',
			'no_data',
			'average_month'
		),
		rates: wordGroup(
			'title',
			'value',
			'buy',
			'sell',
			'source',
			'as_of',
			'refresh',
			'refreshed',
			'manual',
			'manual_hint',
			'saved',
			'none_needed',
			'never'
		),
		more: words,
		system: wordGroup(
			'database',
			'style',
			'config',
			'state',
			'name',
			'locale',
			'last_saved',
			'never',
			'generation',
			'encryption',
			'encrypted',
			'not_encrypted',
			'nightly',
			'file',
			'size',
			'instance',
			'source',
			'defaults_used',
			'base_currency',
			'timezone',
			'extensions',
			'access',
			'access_on',
			'access_off',
			'snapshot_taken',
			'snapshot_failed'
		),
		status: wordGroup(
			'title',
			'healthy',
			'degraded',
			'snapshot_ok',
			'snapshot_pending',
			'snapshot_never',
			'drive_ok',
			'drive_missing',
			'rates_ok',
			'rates_never',
			'missing_rates'
		)
	}),
	assets: z.strictObject({
		favicon: asset,
		logo: asset,
		/**
		 * Character art on the command menu: one image for every command, and optionally one per
		 * command (keys as in copy.nav). Paths to images in app/static; null shows the star pattern.
		 */
		menu_art: z.strictObject({
			default: asset,
			commands: z.record(z.string(), asset.unwrap())
		})
	})
});

export type Style = z.output<typeof styleSchema>;
export type ColorName = keyof Style['colors']['dark'];
