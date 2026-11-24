import * as aws from '@pulumi/aws';

import type { ApiZemnMe } from '#root/ts/pulumi/zemn.me/api/api.js';
import { asyncBinaryFunction, publicEnvironment } from './binary_function.js';

export function zemnFeatureDeployment(api: ApiZemnMe) {
	// Production owns this account-wide issuer; staging uses the same account.
	new aws.iam.OutboundWebIdentityFederation('fixture-outbound-identity');
	return {
		environment: publicEnvironment(api.lambdaFunction, [
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
		]),
		journalWorker: asyncBinaryFunction(
			'journal-worker-invocations',
			api.journalWorker,
			api.journalWorkerRole,
			[
				'JOURNAL_TABLE_NAME',
				'JOURNAL_BUCKET_NAME',
				'JOURNAL_CURATION_ENABLED',
				'OPENAI_IDENTITY_PROVIDER_ID',
				'OPENAI_SERVICE_ACCOUNT_ID',
			]
		),
	};
}
