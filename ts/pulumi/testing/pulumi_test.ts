import 'ts/pulumi/setMocks';

import { describe, expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import { githubActionsSecretIds } from '#root/ts/pulumi/github_actions_secrets.js';
import * as project from '#root/ts/pulumi/index.js';
import { mockResources } from '#root/ts/pulumi/setMocks.js';

describe('pulumi', () => {
	test('smoke', async () => {
		mockResources.splice(0);
		new project.Component('monorepo', { staging: false });
		await pulumi.runtime.disconnect();

		const githubProvider = mockResources.find(
			resource =>
				resource.type ===
				'gcp:iam/workloadIdentityPoolProvider:WorkloadIdentityPoolProvider'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.repository == "zemn-me/monorepo"'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.workflow_ref'
		);
		expect(githubProvider?.inputs['attributeMapping']).toMatchObject({
			'attribute.repository': 'assertion.repository',
			'attribute.workflow_ref': 'assertion.workflow_ref',
			'google.subject': 'assertion.sub',
		});

		const workloadIdentityUser = mockResources.find(
			resource => resource.type === 'gcp:serviceaccount/iAMMember:IAMMember'
		);
		expect(workloadIdentityUser?.inputs).toMatchObject({
			member:
				'principalSet://iam.googleapis.com/projects/845702659200/locations/global/workloadIdentityPools/github/attribute.repository/zemn-me/monorepo',
			role: 'roles/iam.workloadIdentityUser',
			serviceAccountId:
				'projects/extreme-cycling-441523-a9/serviceAccounts/monorepo-root@extreme-cycling-441523-a9.iam.gserviceaccount.com',
		});

		const expectedSecretIds = Object.values(githubActionsSecretIds).sort();
		const secretIds = mockResources
			.filter(
				resource => resource.type === 'gcp:secretmanager/secret:Secret'
			)
			.map(resource => resource.inputs['secretId'])
			.sort();
		expect(secretIds).toEqual(expectedSecretIds);

		const secretIamMembers = mockResources.filter(
			resource =>
				resource.type === 'gcp:secretmanager/secretIamMember:SecretIamMember'
		);
		expect(secretIamMembers).toHaveLength(expectedSecretIds.length);
		for (const secretIamMember of secretIamMembers) {
			expect(secretIamMember.inputs).toMatchObject({
				member:
					'serviceAccount:monorepo-root@extreme-cycling-441523-a9.iam.gserviceaccount.com',
				role: 'roles/secretmanager.secretAccessor',
			});
		}
	});
});
