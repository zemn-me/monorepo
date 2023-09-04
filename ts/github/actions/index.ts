import { appendFile } from 'node:fs/promises';

interface FilePositionParams {
	file?: string;
	line?: string;
	endLine?: string;
	title?: string;
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

const commandIdent =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
		// in GitHub's infinite wisdom, they have not provided any information
		// on canonicalising strings in their key-value format. so i am guessing.
		// may God protect us.
		`::${[
			command,
			Object.entries(parameters)
				.map(
					([k, v]) =>
						`${k.replaceAll(/[,=]/g, '')}=${v.replaceAll(
							/[=,]/g,
							''
						)}`
				)
				.join(','),
		]
			.filter(isDefinedString)
			.join(' ')}::`;

export const Command =
	<T extends keyof CommandValidation>(command: T) =>
	(parameters: CommandValidation[T]) =>
	(line?: string) =>
		(line ?? '').replaceAll(/^/g, commandIdent(command)(parameters));

export const Summarize = async (summary: string) => {
	const step_summary_file_path = process.env['GITHUB_STEP_SUMMARY'];
	const is_github_action = !!process.env['GITHUB_ACTION'];

	if (is_github_action && !step_summary_file_path)
		throw new Error(
			'Detected github action runtime, but missing GITHUB_STEP_SUMMARY, weirdly.'
		);

	if (step_summary_file_path === undefined) {
		console.info('Could not detect GITHUB_STEP_SUMMARY.');
		console.log(summary);
		return undefined;
	}

	return appendFile(step_summary_file_path, summary);
};
