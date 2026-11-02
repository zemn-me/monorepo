import { all, Input } from '@pulumi/pulumi';
import { join } from 'path/posix';

export const s3Uri =
	(bucketName: Input<string>) =>
	(pathName: Input<string>): Input<string> =>
		all([bucketName, pathName]).apply(
			([bucketName, pathName]) => `s3://${join(bucketName, pathName)}`
		);
