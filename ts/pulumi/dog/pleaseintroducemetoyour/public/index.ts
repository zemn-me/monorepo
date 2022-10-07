import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import mime from 'mime';
import { walk } from 'monorepo/ts/fs';
import path from 'path';
import { fileAsset } from 'monorepo/ts/pulumi/lib';

const basePath = runfiles.resolveWorkspaceRelative(
	'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out'
);

function trimPrefix(prefix: string, haystack: string): string {
	if (!haystack.startsWith(prefix))
		throw new Error(
			`Can't trim prefix; ${haystack} doesn't start with ${prefix}`
		);

	return haystack.slice(prefix.length);
}

export const indexPage = fileAsset(
	path.join(basePath, 'index.html')
);
export const errorPage = fileAsset(
	path.join(basePath, '404.html')
);

export const files = (async function* () {
	for await (const entity of walk(basePath)) {
		if (!entity.isFile()) continue;
		yield fileAsset(entity.name);
	}
})();

export const bucket = new aws.s3.Bucket('pleaseintroducemetoyour.dog', {
	acl: 'public-read',
	website: {
		indexDocument: indexPage.then(async asset => trimPrefix(basePath, await asset.path)),
		errorDocument: errorPage.then(async asset => trimPrefix(basePath, await asset.path)),
	},
});

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