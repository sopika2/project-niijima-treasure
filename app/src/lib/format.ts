const SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

/**
 * A day of the month as an ordinal: "1st", "22nd" in English, "1." in languages that write
 * ordinals with a full stop (Hungarian, German…).
 */
export function ordinal(day: number, locale: string): string {
	if (!locale.toLowerCase().startsWith('en')) return `${day}.`;
	const rule = new Intl.PluralRules('en', { type: 'ordinal' }).select(day);
	return `${day}${SUFFIX[rule] ?? 'th'}`;
}
