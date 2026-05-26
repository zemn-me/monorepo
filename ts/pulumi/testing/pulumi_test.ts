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

const resourceInputText = (input: unknown) =>
	typeof input === 'string' ? input : JSON.stringify(input);

interface AwsAssumeRoleStatement {
	Condition: {
		StringEquals: Record<string, string>;
		StringLike: Record<string, string>;
	};
	Sid: string;
}

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
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.event_name == "pull_request"'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.sub == "repo:zemn-me/monorepo:pull_request"'
		);
		expect(githubProvider?.inputs['attributeCondition']).toContain(
			'assertion.ref.startsWith("refs/pull/")'
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

		const awsIamRoles = mockResources.filter(
			resource => resource.type === 'aws:iam/role:Role'
		);
		const githubActionsRole = awsIamRoles.find(
			resource => resource.name === 'monorepo_github_actions_role'
		);
		const githubActionsRolePolicy = resourceInputText(
			githubActionsRole?.inputs['assumeRolePolicy']
		);
		const awsTrustPolicy = JSON.parse(githubActionsRolePolicy) as {
			Statement: AwsAssumeRoleStatement[];
		};
		const awsTrustStatements = Object.fromEntries(
			awsTrustPolicy.Statement.map(statement => [statement.Sid, statement])
		);
		expect(Object.keys(awsTrustStatements).sort()).toEqual([
			'StagingMergeQueue',
			'SubmitMain',
		]);
		expect(
			awsTrustStatements.SubmitMain.Condition.StringEquals
		).toMatchObject({
			'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
			'token.actions.githubusercontent.com:repository':
				'zemn-me/monorepo',
			'token.actions.githubusercontent.com:repository_id': '275403409',
			'token.actions.githubusercontent.com:workflow': 'Submit',
		});
		expect(awsTrustStatements.SubmitMain.Condition.StringLike).toEqual({
			'token.actions.githubusercontent.com:ref': 'refs/heads/main',
			'token.actions.githubusercontent.com:sub':
				'repo:zemn-me/monorepo:ref:refs/heads/main',
		});
		expect(
			awsTrustStatements.StagingMergeQueue.Condition.StringEquals
		).toMatchObject({
			'token.actions.githubusercontent.com:repository':
				'zemn-me/monorepo',
			'token.actions.githubusercontent.com:repository_id': '275403409',
			'token.actions.githubusercontent.com:workflow': 'Staging',
		});
		expect(
			awsTrustStatements.StagingMergeQueue.Condition.StringLike
		).toEqual({
			'token.actions.githubusercontent.com:ref':
				'refs/heads/gh-readonly-queue/*',
			'token.actions.githubusercontent.com:sub':
				'repo:zemn-me/monorepo:ref:refs/heads/gh-readonly-queue/*',
		});

		const awsRolePolicyAttachments = mockResources.filter(
			resource =>
				resource.type ===
				'aws:iam/rolePolicyAttachment:RolePolicyAttachment'
		);
		expect(
			awsRolePolicyAttachments.find(
				resource => resource.name === 'monorepo_github_actions_admin'
			)?.inputs['policyArn']
		).toBe('arn:aws:iam::aws:policy/AdministratorAccess');
	});
});
