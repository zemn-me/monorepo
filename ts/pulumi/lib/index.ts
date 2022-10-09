import * as fs from 'node:fs/promises';

import * as pulumi from '@pulumi/pulumi';

export async function fileAsset(file: string | Promise<string>) {
	await fs.access(await file);
	return new pulumi.asset.FileAsset(await file);
}
