import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import mime from 'mime';
import path from 'path';

const basePath = 'ts/pulumi/im/shadwell/thomas/public';

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

export const bucket = new aws.s3.Bucket('thomas.shadwell.im', {
	acl: 'public-read',
	website: {
		indexDocument: 'index.html',
	},
});

const File = file(bucket);

export const index = File('index.html');

export default bucket;
