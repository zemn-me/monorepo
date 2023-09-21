import { writeFile } from 'node:fs/promises';

interface FilePositionParams {
	file?: string;
	line?: string;
	endLine?: string;
	title?: string;
	col?: string;
	endColumn?: string;
}

interface CommandValidation {
	debug: Record<string, never>;
	notice: FilePositionParams;
	warning: FilePositionParams;
	error: FilePositionParams;
	group: Record<string, never>;
	endgroup: Record<string, never>;
}

const isDefinedString = (v: string | undefined): v is string => v !== undefined;

// https://github.com/actions/toolkit/blob/7b617c260dff86f8d044d5ab0425444b29fa0d18/packages/core/src/command.ts#L80-L85
const escapeCommandValue = (s: string) =>
	s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeKeyValue = (s: string) =>
	escapeCommandValue(s).replace(/=/g, '%3D');

const commandIdent =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
		// in GitHub's infinite wisdom, they have not provided any information
		// on canonicalising strings in their key-value format. so i am guessing.
		// may God protect us.
		`::${[
			command,
			Object.entries(parameters)
				.map(([k, v]) => `${escapeKeyValue(k)}=${escapeKeyValue(v)}`)
				.join(','),
		]
			.filter(isDefinedString)
			.join(' ')}::`;

export const Command =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
	(line?: string) =>
		`${commandIdent(command)(parameters)}${
			line ? escapeCommandValue(line) : ''
		}`;

export const Summarize = async (summary: string) => {
	const step_summary_file_path = process.env['GITHUB_STEP_SUMMARY'];
	if (step_summary_file_path === undefined) return undefined;

	return writeFile(step_summary_file_path, summary);
};
