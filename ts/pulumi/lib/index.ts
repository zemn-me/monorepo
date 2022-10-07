import * as pulumi from '@pulumi/pulumi';
import * as fs from 'node:fs/promises';

export async function fileAsset(file: string | Promise<string>) {
	await fs.access(await file)
	return new pulumi.asset.FileAsset(await file);
}