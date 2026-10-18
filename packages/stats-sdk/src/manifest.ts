import { describeIssues, InvalidFileError } from '@treasure/core';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/** Data an extension can ask for. It gets only what its extension.yml lists under `reads`. */
export const dataSources = ['system', 'accounts'] as const;
export type DataSource = (typeof dataSources)[number];

const settingSchema = z.discriminatedUnion('type', [
	z.strictObject({
		type: z.literal('boolean'),
		default: z.boolean(),
		label: z.string().optional()
	}),
	z.strictObject({
		type: z.literal('number'),
		default: z.number(),
		min: z.number().optional(),
		max: z.number().optional(),
		label: z.string().optional()
	}),
	z.strictObject({
		type: z.literal('text'),
		default: z.string(),
		label: z.string().optional()
	}),
	z.strictObject({
		type: z.literal('choice'),
		options: z.array(z.string()).min(1),
		default: z.string(),
		label: z.string().optional()
	})
]);

export const manifestSchema = z.strictObject({
	/** Folder name and the name used in config.yml and style.yml. */
	id: z
		.string()
		.regex(/^[a-z][a-z0-9-]*$/, { message: 'use lowercase letters, digits and dashes' }),
	name: z.string().min(1),
	version: z.string().regex(/^\d+\.\d+\.\d+$/, { message: 'use a version like 1.0.0' }),
	description: z.string().default(''),
	/** Where the widget appears. */
	placement: z.enum(['dashboard', 'reports']),
	/** How wide the widget is on the dashboard grid. */
	size: z.enum(['normal', 'wide']).default('normal'),
	reads: z.array(z.enum(dataSources)).min(1),
	settings: z.record(z.string(), settingSchema).default({})
});

export type ExtensionManifest = z.output<typeof manifestSchema>;
export type SettingSpec = z.output<typeof settingSchema>;

export function parseManifest(text: string, file: string): ExtensionManifest {
	let raw: unknown;
	try {
		raw = parseYaml(text);
	} catch (error) {
		throw new InvalidFileError(file, `${file} is not valid YAML: ${String(error)}`);
	}
	const result = manifestSchema.safeParse(raw);
	if (!result.success) throw new InvalidFileError(file, describeIssues(file, result.error.issues));
	return result.data;
}

/** Combines an extension's declared defaults with the settings given in config.yml. */
export function resolveSettings(
	manifest: ExtensionManifest,
	given: Readonly<Record<string, unknown>>
): Record<string, unknown> {
	const problems: string[] = [];
	const resolved: Record<string, unknown> = {};
	for (const name of Object.keys(given)) {
		if (!(name in manifest.settings)) problems.push(`"${name}" is not a setting of ${manifest.id}`);
	}
	for (const [name, spec] of Object.entries(manifest.settings)) {
		const value = name in given ? given[name] : spec.default;
		const ok =
			(spec.type === 'boolean' && typeof value === 'boolean') ||
			(spec.type === 'text' && typeof value === 'string') ||
			(spec.type === 'choice' && typeof value === 'string' && spec.options.includes(value)) ||
			(spec.type === 'number' &&
				typeof value === 'number' &&
				(spec.min === undefined || value >= spec.min) &&
				(spec.max === undefined || value <= spec.max));
		if (!ok) problems.push(`${manifest.id}.${name} must be a valid ${spec.type}`);
		resolved[name] = value;
	}
	if (problems.length > 0) {
		throw new InvalidFileError(
			'config.yml',
			`config.yml extensions:\n  - ${problems.join('\n  - ')}`
		);
	}
	return resolved;
}
