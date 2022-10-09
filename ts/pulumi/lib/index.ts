import * as fs from 'node:fs/promises';
import * as aws from '@pulumi/aws';

import * as pulumi from '@pulumi/pulumi';

export async function fileAsset(file: string | Promise<string>) {
	await fs.access(await file);
	return new pulumi.asset.FileAsset(await file);
}

/**
 * Ensure that the given path is correctly formatted for pulumi / aws.
 * 
 * It chokes if there is a leading slash...
 */
export async function transformDocumentPath(path: Promise<string> | string): Promise<string> {
	if ([...await path][0] === "/")
		return transformDocumentPath((await path).slice(1))


	return path;
}

export async function webBucket(name: string, acl: 'public-read', indexDocument: Promise<string> | string, errorDocument?: Promise<string> | string) {
	return new aws.s3.Bucket(
		name, {
			acl,
			website: {
				indexDocument: transformDocumentPath(indexDocument),
				...(errorDocument !== undefined? { errorDocument: transformDocumentPath(errorDocument)}: {})
			}
		}

	)
}
