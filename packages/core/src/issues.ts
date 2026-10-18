import type { z } from 'zod';

/** Turns validation issues into lines a person can act on: "rates.schedule: expected a string". */
export function describeIssues(file: string, issues: readonly z.core.$ZodIssue[]): string {
	const lines = issues.map((issue) => {
		const path = issue.path.length ? issue.path.join('.') : '(top level)';
		return `  - ${path}: ${issue.message}`;
	});
	return `${file} has ${issues.length === 1 ? 'a problem' : `${issues.length} problems`}:\n${lines.join('\n')}`;
}

export class InvalidFileError extends Error {
	readonly file: string;
	constructor(file: string, detail: string) {
		super(detail);
		this.name = 'InvalidFileError';
		this.file = file;
	}
}
