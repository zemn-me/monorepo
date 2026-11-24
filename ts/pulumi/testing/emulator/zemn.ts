import assert from 'node:assert/strict';

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import type { ApiZemnMe } from '#root/ts/pulumi/zemn.me/api/api.js';

export function zemnFeatureDeployment(api: ApiZemnMe) {
	// S3 invokes the deployed worker. Its image cannot run in the emulator,
	// so forward Lambda's invocation record to the local Go worker.
	const queue = new aws.sqs.Queue('journal-worker-invocations');
	const grant = new aws.iam.RolePolicy('journal-invocation-delivery', {
		role: api.journalWorkerRole.name,
		policy: pulumi.jsonStringify({
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Action: 'sqs:SendMessage',
					Resource: queue.arn,
				},
			],
		}),
	});
	new aws.lambda.FunctionEventInvokeConfig(
		'journal-worker-invocations',
		{
			functionName: api.journalWorker.name,
			maximumRetryAttempts: 0,
			destinationConfig: {
				onFailure: { destination: queue.arn },
			},
		},
		{ dependsOn: grant }
	);
	const environment = api.lambdaFunction.environment.apply(env =>
		Object.fromEntries(
			[
				'DYNAMODB_TABLE_NAME',
				'ANALYTICS_TABLE_NAME',
				'GRIEVANCES_TABLE_NAME',
				'USERS_TABLE_NAME',
				'CALLBOX_KEY_TABLE_NAME',
				'OAUTH_TABLE_NAME',
				'JOURNAL_TABLE_NAME',
				'JOURNAL_BUCKET_NAME',
				'OIDC_JWT_KMS_KEY_ID',
				'OIDC_JWT_PUBLIC_KEY',
			].map(name => {
				const value = env?.variables?.[name];
				assert(value, `Missing Lambda environment variable ${name}`);
				return [name, value];
			})
		)
	);
	// Only these public resource names and the public signing key leave Pulumi.
	return {
		environment: pulumi.unsecret(environment),
		journalQueueURL: queue.url,
	};
}
