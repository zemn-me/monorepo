import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';
import * as aws from '@pulumi/aws';
import * as path from 'path';
import * as mime from 'mime';

function publicReadPolicy(bucketName: string) {
	return JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Principal: '*',
				Action: ['s3:GetObject'],
				Resource: [
					`arn:aws:s3:::${bucketName}/*`, // policy refers to bucket name explicitly
				],
			},
		],
	});
}

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket('cultist-simulator-multiplayer', {
	website: {
		indexDocument: 'index.html',
	},
});


const dirRoot = 'project/cultist/multiplayer/dist';

for (const file of fs.readdirSync(dirRoot)) {
	const absPath = path.join(dirRoot, file);
	new aws.s3.BucketObject(file, {
		bucket,
		source: new pulumi.asset.FileAsset(absPath),
		contentType: mime.getType(absPath) || undefined,
	});
}

new aws.s3.BucketPolicy('cultist-simulator-bucket-policy', {
	bucket: bucket.bucket,
	policy: bucket.bucket.apply(publicReadPolicy),
});

// Export the name of the bucket
export const bucketName = bucket.id;
export const websiteUrl = bucket.websiteEndpoint;
