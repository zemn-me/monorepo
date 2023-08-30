import fs from 'node:fs/promises';

import * as pulumi from '@pulumi/pulumi';
import * as path from 'monorepo/ts/pulumi/lib/path.js';

/**
 * Creates a pulumi FileAsset. Also checks the file actually exists,
 * which Pulumi strangely does not do.
 */
export async function asset(file: string | Promise<string>) {
	await fs.access(await file);
	return new pulumi.asset.FileAsset(await file);
}

/**
 * Creates a pulumi FileAsset from some file in the workspace.
 *
 * The path must be a workspace path.
 */
export async function fromWorkspace(file: string | Promise<string>) {
	return asset(path.workspace(file));
}
