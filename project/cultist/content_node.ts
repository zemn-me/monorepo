import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CoreContent } from '#root/project/cultist/content.js';
import {
	mergeCoreDocuments,
	parseFucineSource,
} from '#root/project/cultist/content.js';

async function* jsonFiles(root: string): AsyncGenerator<string> {
	const entries = await fs.readdir(root, { withFileTypes: true });

	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const entryPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			yield* jsonFiles(entryPath);
		} else if (
			(entry.isFile() || entry.isSymbolicLink()) &&
			entry.name.endsWith('.json')
		) {
			yield entryPath;
		}
	}
}

export function defaultCoreContentDir(): string {
	if (process.env.CULTIST_CORE_CONTENT !== undefined) {
		return process.env.CULTIST_CORE_CONTENT;
	}

	const candidates = [
		path.join(path.dirname(fileURLToPath(import.meta.url)), 'content/core'),
		path.join(process.cwd(), 'project/cultist/content/core'),
	];

	const found = candidates.find(candidate => existsSync(candidate));
	return found ?? candidates[0]!;
}

export async function loadCoreContent(
	root: string = defaultCoreContentDir()
): Promise<CoreContent> {
	const documents = [];

	for await (const file of jsonFiles(root)) {
		const source = await fs.readFile(file, 'utf8');
		if (source.replace(/^\uFEFF/, '').trim() === '') continue;
		documents.push(parseFucineSource(source));
	}

	return mergeCoreDocuments(documents);
}
