import * as aws from '@pulumi/aws';

import * as iter from '#root/ts/iter/index.js';
export * as file from '#root/ts/pulumi/lib/file.js';
export * as path from '#root/ts/pulumi/lib/path.js';

/**
 * Trim a prefix from some strings, potentially asynchronously.
 */
export async function trimPrefix(
	prefix: Promise<string>,
	haystack: Promise<string>
): Promise<string> {
	if (!(await haystack).startsWith(await prefix))
		throw new Error(
			`Can't trim prefix; ${await haystack} doesn't start with ${await prefix}`
		);

	return (await haystack).slice((await prefix).length);
}

/**
 * Ensure that the given path is correctly formatted for pulumi / aws.
 *
 * It chokes if there is a leading slash...
 */
export async function transformDocumentPath(
	path: Promise<string> | string
): Promise<string> {
	if ([...(await path)][0] === '/')
		return transformDocumentPath((await path).slice(1));

	return path;
}

/**
 * Wrapper for aws.s3.Bucket, which ensures website.indexDocument and website.errorDocument
 * have correctly formatted paths.
 */
export function webBucket(
	name: string,
	acl: 'public-read',
	indexDocument: Promise<string> | string,
	errorDocument?: Promise<string> | string
) {
	return new aws.s3.Bucket(name, {
		acl,
		website: {
			indexDocument: transformDocumentPath(indexDocument),
			...(errorDocument !== undefined
				? { errorDocument: transformDocumentPath(errorDocument) }
				: {}),
		},
	});
}

/**
 * Use a generator to generate some values.
 *
 * Because pulumi doesn't know what a generator means as an export, this
 * converts it into a simple promise.
 */
export async function generator<T>(fn: AsyncGenerator<T>): Promise<T[]> {
	const ret = await iter.unroll(fn);
	if (ret.length == 0)
		throw new Error(
			'Request to unroll an iterator which has length 0 -- maybe the iterator has some issue?'
		);
	return ret;
}
