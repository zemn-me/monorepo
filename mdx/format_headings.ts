import { readFile, writeFile } from 'node:fs/promises';

const TITLE_UNDERLINE_WIDTH = 79;
const TITLE_UNDERLINE = '='.repeat(TITLE_UNDERLINE_WIDTH);

function centerTitle(title: string): string {
	const trimmedTitle = title.trim();
	const padding = TITLE_UNDERLINE_WIDTH - trimmedTitle.length;
	if (padding <= 0) {
		return trimmedTitle;
	}
	return `${' '.repeat(Math.floor(padding / 2))}${trimmedTitle}`;
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

	for (let index = 0; index < lines.length; index++) {
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
			const title = line.match(/^#\s+(.+?)(?:\s+#+)?\s*$/);
			if (title) {
				output.push(centerTitle(title[1]));
				output.push(TITLE_UNDERLINE);
				continue;
			}

			if (line !== '' && /^=+$/.test(lines[index + 1] ?? '')) {
				output.push(centerTitle(line));
				output.push(TITLE_UNDERLINE);
				index++;
				continue;
			}

			if (
				line !== '' &&
				lines[index + 1] === '' &&
				/^=+$/.test(lines[index + 2] ?? '')
			) {
				output.push(centerTitle(line));
				output.push(TITLE_UNDERLINE);
				index += 2;
				continue;
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
