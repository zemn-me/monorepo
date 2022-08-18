import * as aws from '@pulumi/aws';
import { runfiles } from '@bazel/runfiles';
import * as pulumi from '@pulumi/pulumi';
import mime from 'mime';
import path from 'path';

const basePath = 'ts/pulumi/dog/pleaseintroducemetoyour/public';

const file = (bucket: aws.s3.BucketObjectArgs['bucket']) => (relativePath: string) => {
    const workspacePath = path.posix.join(basePath, relativePath);
    const absolutePath = runfiles.resolveWorkspaceRelative(workspacePath);
	return new aws.s3.BucketObject(workspacePath, {
		key: workspacePath,
		bucket,
		contentType: mime.getType(absolutePath) || undefined,
		source: new pulumi.asset.FileAsset(absolutePath),
	});
}

const uploadContent = (bucket: aws.s3.BucketObjectArgs['bucket']) => {
	const File = file(bucket);
	File('index.html');
};

export const bucket = new aws.s3.Bucket('pleaseintroducemetoyour.dog', {
	acl: 'public-read',
	website: {
		indexDocument: 'index.html',
	},
});

uploadContent(bucket);

export default bucket;
