import { invalidateAll } from '$app/navigation';
import type { ActionResult } from '$app/forms';
import type { Style } from '@treasure/style';

export type Errors = Record<string, string>;

/**
 * Shared form handling: on success reload the page data and run `done`; on a validation
 * failure hand the field error codes to `failed`.
 */
export function submitter(
	done: (data: Record<string, unknown>) => void,
	failed: (errors: Errors) => void = () => {}
): (input?: unknown) => (opts: { result: ActionResult }) => Promise<void> {
	return () =>
		async ({ result }) => {
			if (result.type === 'success') {
				failed({});
				await invalidateAll();
				done((result.data as Record<string, unknown> | undefined) ?? {});
			} else if (result.type === 'failure') {
				failed((result.data?.errors as Errors | undefined) ?? { form: 'generic' });
			} else {
				failed({ form: 'generic' });
			}
		};
}

/** The sentence from style.yml for an error code on a field, or null. */
export function errorText(copy: Style['copy'], errors: Errors, field: string): string | null {
	const code = errors[field];
	if (!code) return null;
	return copy.errors[code as keyof typeof copy.errors] ?? copy.errors.generic;
}

/** Fills {placeholders} in a sentence from style.yml. */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? String(values[name]) : match
	);
}
