import { join } from 'node:path/posix';

import { all, Input } from '@pulumi/pulumi';

export const s3Uri =
	(bucketName: Input<string>) =>
	(pathName: Input<string>): Input<string> =>
		all([bucketName, pathName]).apply(
			([bucketName, pathName]) => `s3://${join(bucketName, pathName)}`
		);
