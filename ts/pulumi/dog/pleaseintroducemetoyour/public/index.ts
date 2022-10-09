import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import mime from 'mime';
import { walk } from 'monorepo/ts/fs';
import { fileAsset, webBucket } from 'monorepo/ts/pulumi/lib';
import path from 'path';

const basePath = runfiles.resolveWorkspaceRelative(
	'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out'
);

async function trimPrefix(prefix: Promise<string> | string, haystack: Promise<string> | string): Promise<string> {
	if (!(await haystack).startsWith(await prefix))
		throw new Error(
			`Can't trim prefix; ${await haystack} doesn't start with ${await prefix}`
		);

	return (await haystack).slice((await prefix).length);
}

export const indexPage = fileAsset(path.join(basePath, 'index.html'));
export const errorPage = fileAsset(path.join(basePath, '404.html'));

export const files = (async function* () {
	for await (const entity of walk(basePath)) {
		if (!entity.isFile()) continue;
		yield fileAsset(entity.name);
	}
})();


export const bucket = (async () => webBucket(
	'pleaseintroducemetoyour.dog',
	'public-read',
	trimPrefix(basePath, (await indexPage).path),
	trimPrefix(basePath, (await errorPage).path)
))();


export const bucketObjects = (async function* () {
	for await (const file of files) {
		yield new aws.s3.BucketObject(await file.path, {
			key: trimPrefix(basePath, await file.path),
			bucket,
			contentType: mime.getType(await file.path) ?? undefined,
			source: file,
			acl: 'public-read',
		});
	}
})();

export default bucket;
