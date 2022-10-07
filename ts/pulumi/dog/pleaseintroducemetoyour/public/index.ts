import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';
import { walk } from 'monorepo/ts/fs';
import path from 'path';

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

export const indexPage = new pulumi.asset.FileAsset(
	path.join(basePath, 'index.html')
);
export const errorPage = new pulumi.asset.FileAsset(
	path.join(basePath, '404.html')
);

export const files = (async function* () {
	for await (const entity of walk(basePath)) {
		if (!entity.isFile()) continue;
		yield new pulumi.asset.FileAsset(entity.name);
	}
})();

export const bucket = new aws.s3.Bucket('pleaseintroducemetoyour.dog', {
	acl: 'public-read',
	website: {
		indexDocument: indexPage.path.then(path => trimPrefix(basePath, path)),
		errorDocument: errorPage.path.then(path => trimPrefix(basePath, path)),
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

throw new Error('fuck');

export default bucket;
