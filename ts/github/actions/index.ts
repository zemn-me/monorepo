import constants from 'node:constants';
import { writeFile } from 'node:fs/promises';

export interface FilePositionParams {
	file?: string;
	line?: string;
	endLine?: string;
	title?: string;
	col?: string;
	endColumn?: string;
}

interface CommandValidation {
	debug: FilePositionParams;
	notice: FilePositionParams;
	warning: FilePositionParams;
	error: FilePositionParams;
	group: Record<string, never>;
	endgroup: Record<string, never>;
}

export function toCommandValue(input: unknown): string {
	if (input === null || input === undefined) {
		return '';
	}
	if (typeof input === 'string' || input instanceof String) {
		return input as string;
	}
	return JSON.stringify(input);
}

function escapeData(s: unknown): string {
	return toCommandValue(s)
		.replace(/%/g, '%25')
		.replace(/\r/g, '%0D')
		.replace(/\n/g, '%0A');
}

function escapeProperty(s: unknown): string {
	return toCommandValue(s)
		.replace(/%/g, '%25')
		.replace(/\r/g, '%0D')
		.replace(/\n/g, '%0A')
		.replace(/:/g, '%3A')
		.replace(/,/g, '%2C');
}

const isDefinedString = (v: string | undefined): v is string => v !== undefined;

const commandIdent =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
		// in GitHub's infinite wisdom, they have not provided any information
		// on canonicalising strings in their key-value format. so i am guessing.
		// may God protect us.
		`::${[
			command,
			Object.entries(parameters)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `${escapeProperty(k)}=${escapeProperty(v)}`)
				.join(','),
		]
			.filter(isDefinedString)
			.join(' ')}::`;

export const Command =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
	(line?: string) =>
		commandIdent(command)(parameters) + escapeData(line);

export const Summarize = async (summary: string) => {
	const step_summary_file_path = process.env['GITHUB_STEP_SUMMARY'];
	if (step_summary_file_path === undefined) return undefined;

	return writeFile(step_summary_file_path, summary, {
		flag: constants.O_APPEND,
	});
};
