import * as path from 'node:path';

import * as fs from 'fs';
import { readdir } from 'fs/promises';
import * as iter from 'monorepo/ts/iter/index.js';

type Dirent = fs.Dirent;

/**
 * Given a set of {@link fs.Dirent}s, returns a path from the leftmost
 * to the rightmost one.
 */
export function getPath(...d: Pick<fs.Dirent, 'name'>[]) {
	return path.join(...d.reverse().map(v => v.name));
}

/**
 * Given a path which must be a directory, return all of
 * its children.
 */
async function* _walk(
	path: Promise<string> | string
): AsyncGenerator<[value: Dirent, ...parents: Dirent[]], void, unknown> {
	const fakeRoot = {
		name: await path,
		isDirectory() {
			return true;
		},
		isFile() {
			return false;
		},
		isBlockDevice() {
			return false;
		},
		isCharacterDevice() {
			return false;
		},
		isSymbolicLink() {
			throw new Error('possibly.');
		},
		isFIFO() {
			return false;
		},
		isSocket() {
			return false;
		},
		path: await path,
	};
	yield* iter.asyncWalkPath<Dirent>(
		// this is a fake root dir to make the code simpler.
		fakeRoot,
		// if the current node is a directory, walk its children.
		async ([v, ...parents]) =>
			v.isDirectory()
				? readdir(getPath(v, ...parents), {
						withFileTypes: true,
				  })
				: []
	);
}

/**
 * Given a path which must be a directory, return all of
 * its children.
 */
export async function* walk(
	path: Promise<string> | string
): AsyncGenerator<
	[path: [value: Dirent, ...parents: Dirent[]], getPathString: () => string]
> {
	for await (const value of _walk(path)) {
		yield [value, () => getPath(...value)];
	}
}
