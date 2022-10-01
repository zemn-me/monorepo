import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';
import glob from 'glob-promise';
import path from 'path';

const basePath = 'ts/pulumi/dog/pleaseintroducemetoyour/public/static/out';

const file =
	(bucket: aws.s3.BucketObjectArgs['bucket']) => (relativePath: string) => {
		const workspacePath = path.posix.join(basePath, relativePath);
		const absolutePath = runfiles.resolveWorkspaceRelative(workspacePath);
		return new aws.s3.BucketObject(workspacePath, {
			key: workspacePath,
			bucket,
			contentType: mime.getType(absolutePath) || undefined,
			source: new pulumi.asset.FileAsset(absolutePath),
			acl: 'public-read',
		});
	};

export const bucket = new aws.s3.Bucket('pleaseintroducemetoyour.dog', {
	acl: 'public-read',
	website: {
		indexDocument: 'index.html',
	},
});

const File = file(bucket);

async function Files() {
	let ret = [];
	for (const file of (await glob(basePath + '/*'))) {
		ret.push(File(file))
	}
	return ret;
}

export const files = Files();


export default bucket;
