import path from 'node:path';

import { runfiles } from '@bazel/runfiles';

/**
 * Returns the real, on-disk path of a given workspace path.
 */
export async function workspace(
	path: Promise<string> | string
): Promise<string> {
	return runfiles.resolveWorkspaceRelative(await path);
}

/**
 * Join a number of asynchronous path segments.
 */
export async function join(
	...paths: (Promise<string> | string)[]
): Promise<string> {
	return path.join(...(await Promise.all(paths)));
}
