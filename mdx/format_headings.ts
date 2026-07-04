import { readFile, writeFile } from 'node:fs/promises';

const TITLE_UNDERLINE_WIDTH = 79;

function formatTitle(title: string): string {
	return title.trim();
}

function underlineFor(marker: '=' | '-'): string {
	return marker.repeat(TITLE_UNDERLINE_WIDTH);
}

function isSetextUnderline(line: string, marker: '=' | '-'): boolean {
	return new RegExp(`^\\s*\\${marker}+$`).test(line);
}

function splitLines(text: string): {
	lines: string[];
	trailingNewline: boolean;
} {
	if (text === '') {
		return { lines: [], trailingNewline: false };
	}
	const trailingNewline = text.endsWith('\n');
	const body = trailingNewline ? text.slice(0, -1) : text;
	return { lines: body.split('\n'), trailingNewline };
}

function isFence(line: string): RegExpMatchArray | null {
	return line.match(/^(`{3,}|~{3,})/);
}

function formatHeadings(text: string): string {
	const { lines, trailingNewline } = splitLines(text);
	const output: string[] = [];
	let inFrontmatter = lines[0] === '---';
	let inFence = false;
	let fenceMarker = '';

	lines: for (let index = 0; index < lines.length; index++) {
		const line = lines[index];

		if (inFrontmatter) {
			output.push(line);
			if (index > 0 && line === '---') {
				inFrontmatter = false;
			}
			continue;
		}

		const fence = isFence(line);
		if (fence) {
			const marker = fence[1][0];
			if (!inFence) {
				inFence = true;
				fenceMarker = marker;
			} else if (marker === fenceMarker) {
				inFence = false;
				fenceMarker = '';
			}
			output.push(line);
			continue;
		}

		if (!inFence) {
			const atxHeading = line.match(/^(#{1,2})\s+(.+?)(?:\s+#+)?\s*$/);
			if (atxHeading) {
				const marker = atxHeading[1] === '#' ? '=' : '-';
				output.push(formatTitle(atxHeading[2]));
				output.push(underlineFor(marker));
				continue;
			}

			if (line !== '') {
				for (const marker of ['=', '-'] as const) {
					if (isSetextUnderline(lines[index + 1] ?? '', marker)) {
						output.push(formatTitle(line));
						output.push(underlineFor(marker));
						index++;
						continue lines;
					}

					if (
						lines[index + 1] === '' &&
						isSetextUnderline(lines[index + 2] ?? '', marker)
					) {
						output.push(formatTitle(line));
						output.push(underlineFor(marker));
						index += 2;
						continue lines;
					}
				}
			}
		}

		output.push(line);
	}

	return output.join('\n') + (trailingNewline ? '\n' : '');
}

async function main(): Promise<void> {
	const [, , ...args] = process.argv;
	const write = args[0] === '--write';
	const files = write ? args.slice(1) : args;

	if (files.length === 0) {
		process.stderr.write('usage: format_headings [--write] <file>...\n');
		process.exitCode = 2;
		return;
	}

	let changed = false;
	for (const file of files) {
		const original = await readFile(file, 'utf8');
		const formatted = formatHeadings(original);
		if (formatted === original) {
			continue;
		}
		changed = true;
		if (write) {
			await writeFile(file, formatted);
		} else {
			process.stdout.write(`${file}\n`);
		}
	}

	if (changed && !write) {
		process.exitCode = 1;
	}
}

await main();
