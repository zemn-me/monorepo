import 'ts/pulumi/setMocks';

import { describe, expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import {
	githubActionsSecretAccessByWorkflow,
	githubActionsSecretIds,
} from '#root/ts/pulumi/github_actions_secrets.js';
import * as project from '#root/ts/pulumi/index.js';
import { mockResources } from '#root/ts/pulumi/setMocks.js';

const workflowScopePrincipal = (workflowScope: string) =>
	`principalSet://iam.googleapis.com/projects/845702659200/locations/global/workloadIdentityPools/github/attribute.workflow_scope/${workflowScope}`;

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
			'assertion.repository_id == "275403409"'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.repository_owner_id == "145876100"'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.workflow_ref'
		);
		expect(githubProvider?.inputs['attributeMapping']).toMatchObject({
			'attribute.repository': 'assertion.repository',
			'attribute.repository_id': 'assertion.repository_id',
			'attribute.repository_owner_id': 'assertion.repository_owner_id',
			'attribute.workflow_ref': 'assertion.workflow_ref',
			'attribute.workflow_scope': expect.stringContaining('submit'),
			'google.subject': 'assertion.sub',
		});

		const workloadIdentityUsers = mockResources.filter(
			resource => resource.type === 'gcp:serviceaccount/iAMMember:IAMMember'
		);
		expect(
			workloadIdentityUsers.map(resource => resource.inputs['member']).sort()
		).toEqual([
			workflowScopePrincipal('staging'),
			workflowScopePrincipal('submit'),
		]);
		for (const workloadIdentityUser of workloadIdentityUsers) {
			expect(workloadIdentityUser.inputs).toMatchObject({
				role: 'roles/iam.workloadIdentityUser',
				serviceAccountId:
					'projects/extreme-cycling-441523-a9/serviceAccounts/monorepo-root@extreme-cycling-441523-a9.iam.gserviceaccount.com',
			});
		}

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
		const expectedSecretIamMemberNames = Object.entries(
			githubActionsSecretAccessByWorkflow
		)
			.flatMap(([workflowScope, secretIds]) =>
				secretIds.map(
					secretId =>
						`monorepo_github_actions_secrets_${workflowScope}_${secretId}_accessor`
					)
			)
			.sort();
		expect(secretIamMembers.map(resource => resource.name).sort()).toEqual(
			expectedSecretIamMemberNames
		);
		for (const secretIamMember of secretIamMembers) {
			expect(secretIamMember.inputs['member']).toContain(
				'/attribute.workflow_scope/'
			);
			expect(secretIamMember.inputs['member']).not.toContain(
				'monorepo-root@extreme-cycling-441523-a9.iam.gserviceaccount.com'
			);
			expect(secretIamMember.inputs).toMatchObject({
				role: 'roles/secretmanager.secretAccessor',
			});
		}
	});
});
