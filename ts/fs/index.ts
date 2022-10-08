import { Dirent } from 'fs';
import { readdir } from 'fs/promises';

export async function* walk(path: string): AsyncGenerator<Dirent> {
	for (const entity of await readdir(path, { withFileTypes: true })) {
		if (entity.isDirectory()) yield* walk(entity.name);
		yield entity;
	}
}
