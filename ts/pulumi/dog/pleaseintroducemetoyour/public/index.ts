import * as aws from '@pulumi/aws';
import mime from 'mime';
import { walk } from 'monorepo/ts/fs';
import * as lib from 'monorepo/ts/pulumi/lib';
import { trimPrefix, webBucket } from 'monorepo/ts/pulumi/lib';

const basePath = lib.path.workspace(
	'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out'
);

export const indexPage = lib.file.asset(lib.path.join(basePath, 'index.html'));
export const errorPage = lib.file.asset(lib.path.join(basePath, '404.html'));

export const files = lib.generator((async function* () {
	for await (const entity of walk(basePath)) {
		if (!entity.isFile()) continue;
		yield lib.file.asset(entity.name);
	}
})());

export const bucket = webBucket(
	'pleaseintroducemetoyour.dog',
	'public-read',
	trimPrefix(
		basePath,
		indexPage.then(v => v.path)
	),
	trimPrefix(
		basePath,
		errorPage.then(v => v.path)
	)
);

export const bucketObjects = lib.generator((async function* () {
	for (const file of await files) {
		yield new aws.s3.BucketObject(await file.path, {
			key: trimPrefix(basePath, file.path),
			bucket,
			contentType: mime.getType(await file.path) ?? undefined,
			source: file,
			acl: 'public-read',
		});
	}
})());

export default bucket;
