import '#root/ts/pulumi/setMocks.js';

import { describe, expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import {
	githubActionsSecretAccessByWorkflow,
	githubActionsSecretIds,
} from '#root/ts/pulumi/github_actions_secrets.js';
import * as project from '#root/ts/pulumi/index.js';
import {
	isAwsAlphaNumericHyphenUnderscoreName,
	isAwsEcsTaskFamilyName,
	isAwsElbv2Name,
	isAwsLambdaFunctionName,
	isAwsLambdaStatementId,
	isAwsTargetGroupName,
	sanitizeAwsAlphaNumericHyphenUnderscoreName,
	sanitizeAwsEcsTaskFamilyName,
	sanitizeAwsElbv2Name,
	sanitizeAwsLambdaFunctionName,
	sanitizeAwsLambdaStatementId,
	sanitizeAwsTargetGroupName,
} from '#root/ts/pulumi/lib/awsNames.js';
import { mockResources } from '#root/ts/pulumi/setMocks.js';

const workflowScopePrincipal = (workflowScope: string) =>
	`principalSet://iam.googleapis.com/projects/845702659200/locations/global/workloadIdentityPools/github/attribute.workflow_scope/${workflowScope}`;

const resourceInputText = (input: unknown) =>
	typeof input === 'string' ? input : JSON.stringify(input);

const awsAlphaNumericHyphenUnderscoreNameInputs = [
	{
		input: 'name',
		type: 'aws:cloudfront/function:Function',
	},
	{
		input: 'name',
		type: 'aws:ecs/cluster:Cluster',
	},
	{
		input: 'name',
		type: 'aws:ecs/service:Service',
	},
] as const;

const awsElbv2NameInputs = [
	{
		type: 'aws:lb/loadBalancer:LoadBalancer',
	},
	{
		type: 'aws:lb/targetGroup:TargetGroup',
	},
] as const;
const awsEcsTaskDefinitionFamilyInputs = [
	{
		type: 'aws:ecs/taskDefinition:TaskDefinition',
	},
] as const;
const awsLambdaFunctionNameInputs = [
	{
		type: 'aws:lambda/function:Function',
	},
] as const;
const awsLambdaPermissionStatementIdInputs = [
	{
		type: 'aws:lambda/permission:Permission',
	},
] as const;
const awsElbv2NameMaxLength = 32;
const awsLambdaFunctionNameMaxLength = 64;
const pulumiAutoNameRandomSuffixLength = 7;
const awsElbv2NamePattern = /^[A-Za-z0-9-]+$/;

interface AwsAssumeRoleStatement {
	Condition: {
		StringEquals: Record<string, string>;
		StringLike: Record<string, string>;
	};
	Sid: string;
}

interface EcrLifecyclePolicy {
	rules: {
		action: {
			type: string;
		};
		description: string;
		selection: {
			countNumber: number;
			countType: string;
			tagStatus: string;
		};
	}[];
}

describe('pulumi', () => {
	test('sanitizes AWS alphanumeric hyphen underscore names', () => {
		expect(
			sanitizeAwsAlphaNumericHyphenUnderscoreName(
				'monorepo_zemn.me_minecraft-cluster'
			)
		).toBe('monorepo_zemn_me_minecraft-cluster');

		expect(
			isAwsAlphaNumericHyphenUnderscoreName(
				'monorepo_zemn_me_minecraft-cluster'
			)
		).toBe(true);
		expect(
			isAwsAlphaNumericHyphenUnderscoreName(
				'monorepo_zemn.me_minecraft-cluster'
			)
		).toBe(false);

		expect(sanitizeAwsTargetGroupName('monorepo_zemn.me_minecraft-tg')).toBe(
			'monorepo-zemn-me-minecraft-tg'
		);
		expect(isAwsTargetGroupName('monorepo-zemn-me-minecraft-tg')).toBe(true);
		expect(sanitizeAwsElbv2Name('monorepo_zemn.me_minecraft-nlb')).toBe(
			'monorepo-zemn-me-minecraft-nlb'
		);
		expect(isAwsElbv2Name('monorepo-zemn-me-minecraft-nlb')).toBe(true);

		expect(sanitizeAwsEcsTaskFamilyName('monorepo_zemn.me_minecraft')).toBe(
			'monorepo_zemn_me_minecraft'
		);
		expect(isAwsEcsTaskFamilyName('monorepo_zemn_me_minecraft')).toBe(true);
		expect(isAwsEcsTaskFamilyName('monorepo_zemn.me_minecraft')).toBe(false);

		expect(sanitizeAwsLambdaFunctionName('monorepo_zemn.me_minecraft-wake')).toBe(
			'monorepo_zemn_me_minecraft-wake'
		);
		expect(isAwsLambdaFunctionName('monorepo_zemn_me_minecraft-wake')).toBe(
			true
		);
		expect(isAwsLambdaFunctionName('monorepo_zemn.me_minecraft-wake')).toBe(
			false
		);
		expect(sanitizeAwsLambdaFunctionName('x'.repeat(65))).toHaveLength(64);

		expect(
			sanitizeAwsLambdaStatementId(
				'monorepo_zemn.me_minecraft_eventbridge_permission'
			)
		).toBe('monorepo_zemn_me_minecraft_eventbridge_permission');
		expect(
			isAwsLambdaStatementId(
				'monorepo_zemn_me_minecraft_eventbridge_permission'
			)
		).toBe(true);
		expect(
			isAwsLambdaStatementId(
				'monorepo_zemn.me_minecraft_eventbridge_permission'
			)
		).toBe(false);
		expect(sanitizeAwsLambdaStatementId('x'.repeat(101))).toHaveLength(100);
	});

	test('staging minecraft uses staging-specific resources', async () => {
		mockResources.splice(0);
		new project.Component('monorepo', { staging: true });
		await pulumi.runtime.disconnect();

		expect(
			mockResources.some(
				resource =>
					resource.name.includes('_minecraft_') &&
					resource.type.startsWith('aws:lb/')
			)
		).toBe(false);

		const minecraftPrivateZone = mockResources.find(
			resource =>
				resource.type === 'aws:route53/zone:Zone' &&
				resource.name.endsWith('_minecraft_private_zone')
		);
		expect(minecraftPrivateZone?.inputs['name']).toBe(
			'internal.minecraft.staging.zemn.me'
		);

		const minecraftRconRecord = mockResources.find(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.endsWith('_minecraft_rcon_dns')
		);
		expect(minecraftRconRecord?.inputs).toMatchObject({
			name: 'rcon.internal.minecraft.staging.zemn.me',
			records: ['10.42.0.254'],
			ttl: 30,
			type: 'A',
		});

		const minecraftCluster = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/cluster:Cluster' &&
				resource.name.endsWith('_minecraft_cluster')
		);
		expect(minecraftCluster?.inputs['name']).toBe(
			'zemn_me_minecraft_staging_cluster'
		);

		const minecraftTaskDefinition = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/taskDefinition:TaskDefinition' &&
				resource.name.endsWith('_minecraft_task')
		);
		expect(minecraftTaskDefinition?.inputs['family']).toBe(
			'zemn_me_minecraft_staging_task'
		);

		const minecraftService = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/service:Service' &&
				resource.name.endsWith('_minecraft_service')
		);
		expect(minecraftService?.inputs['name']).toBe(
			'zemn_me_minecraft_staging_service'
		);

		const minecraftWakeFunction = mockResources.find(
			resource =>
				resource.type === 'aws:lambda/function:Function' &&
				resource.name.endsWith('_minecraft_wake')
		);
		expect(minecraftWakeFunction?.inputs['name']).toBe(
			'zemn_me_minecraft_staging_wake'
		);

		const minecraftEventbridgePermission = mockResources.find(
			resource =>
				resource.type === 'aws:lambda/permission:Permission' &&
				resource.name.endsWith('_minecraft_eventbridge_permission')
		);
		expect(minecraftEventbridgePermission?.inputs['statementId']).toBe(
			'monorepo_zemn_me_minecraft_eventbridge_permission'
		);

		const minecraftRecords = mockResources.filter(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.includes('_minecraft_')
		);
		expect(minecraftRecords.length).toBeGreaterThan(0);
		for (const record of minecraftRecords) {
			expect(resourceInputText(record.inputs['name'])).toContain(
				'staging.zemn.me'
			);
			expect(resourceInputText(record.inputs['name'])).not.toContain(
				'minecraft.zemn.me'
			);
		}

		expect(
			mockResources.some(
				resource => resource.type === 'aws:route53/queryLog:QueryLog'
			)
		).toBe(false);
		expect(
			mockResources.some(
				resource =>
					resource.type === 'aws:route53/zone:Zone' &&
					resource.name.endsWith('_minecraft_zone')
			)
		).toBe(false);
	});

	test('staging resources are not protected', async () => {
		mockResources.splice(0);
		const protectedResources: string[] = [];
		new project.Component(
			'monorepo',
			{ staging: true },
			{
				transformations: [
					args => {
						if (args.opts.protect === true) {
							protectedResources.push(`${args.type} ${args.name}`);
						}
						return undefined;
					},
				],
			}
		);
		await pulumi.runtime.disconnect();

		expect(protectedResources).toEqual([]);
	});

	test('smoke', async () => {
		mockResources.splice(0);
		new project.Component('monorepo', { staging: false });
		await pulumi.runtime.disconnect();

		const awsNameViolations = awsAlphaNumericHyphenUnderscoreNameInputs.flatMap(
			({ input, type }) =>
				mockResources
					.filter(resource => resource.type === type)
					.flatMap(resource => {
						const value = resource.inputs[input];
						if (typeof value !== 'string') {
							if (isAwsAlphaNumericHyphenUnderscoreName(resource.name)) {
								return [];
							}

							return [
								`${type} resource ${JSON.stringify(resource.name)} chooses AWS physical name ${JSON.stringify(resource.name)} from its logical resource name because it has no explicit ${JSON.stringify(input)} input. That name is invalid for AWS and will fail during deployment because AWS only allows letters, numbers, hyphens, and underscores. Set ${input}: sanitizeAwsAlphaNumericHyphenUnderscoreName(${JSON.stringify(resource.name)}).`,
							];
						}
						if (isAwsAlphaNumericHyphenUnderscoreName(value)) {
							return [];
						}

						return [
							`${type} resource ${JSON.stringify(resource.name)} chooses AWS physical name ${JSON.stringify(value)} from its explicit ${JSON.stringify(input)} input. That name is invalid for AWS and will fail during deployment because AWS only allows letters, numbers, hyphens, and underscores.`,
						];
					})
		);
		if (awsNameViolations.length > 0) {
			throw new Error(
				`AWS physical name validation failed:\n${awsNameViolations.map(violation => `- ${violation}`).join('\n')}`
			);
		}

		const lambdaFunctionNameViolations = awsLambdaFunctionNameInputs.flatMap(
			({ type }) =>
				mockResources
					.filter(resource => resource.type === type)
					.flatMap(resource => {
						const value = resource.inputs['name'];
						if (typeof value === 'string') {
							if (isAwsLambdaFunctionName(value)) {
								return [];
							}

							return [
								`${type} resource ${JSON.stringify(resource.name)} chooses Lambda function name ${JSON.stringify(value)} from its explicit "name" input. That name is invalid for AWS and will fail during deployment because Lambda function names must be 64 characters or fewer and contain only letters, numbers, hyphens, and underscores.`,
							];
						}

						const implicitNamePrefix = `${resource.name}-`;
						const implicitNameLength =
							implicitNamePrefix.length + pulumiAutoNameRandomSuffixLength;
						if (
							implicitNameLength <= awsLambdaFunctionNameMaxLength &&
							isAwsAlphaNumericHyphenUnderscoreName(implicitNamePrefix)
						) {
							return [];
						}

						return [
							`${type} resource ${JSON.stringify(resource.name)} chooses Lambda function name prefix ${JSON.stringify(implicitNamePrefix)} plus ${pulumiAutoNameRandomSuffixLength} random Pulumi auto-name characters because it has no explicit "name" input. That generated name is invalid for AWS and will fail during deployment because Lambda function names must be 64 characters or fewer and contain only letters, numbers, hyphens, and underscores. Set name to an explicit valid Lambda function name.`,
						];
					})
		);
		if (lambdaFunctionNameViolations.length > 0) {
			throw new Error(
				`AWS Lambda function name validation failed:\n${lambdaFunctionNameViolations.map(violation => `- ${violation}`).join('\n')}`
			);
		}

		const lambdaPermissionStatementIdViolations =
			awsLambdaPermissionStatementIdInputs.flatMap(({ type }) =>
				mockResources
					.filter(resource => resource.type === type)
					.flatMap(resource => {
						const value = resource.inputs['statementId'];
						if (typeof value === 'string') {
							if (isAwsLambdaStatementId(value)) {
								return [];
							}

							return [
								`${type} resource ${JSON.stringify(resource.name)} chooses Lambda permission statement ID ${JSON.stringify(value)} from its explicit "statementId" input. That statement ID is invalid for AWS and will fail during deployment because Lambda permission statement IDs must be 100 characters or fewer and contain only letters, numbers, hyphens, and underscores.`,
							];
						}

						if (isAwsLambdaStatementId(resource.name)) {
							return [];
						}

						return [
							`${type} resource ${JSON.stringify(resource.name)} chooses Lambda permission statement ID ${JSON.stringify(resource.name)} from its logical resource name because it has no explicit "statementId" input. That statement ID is invalid for AWS and will fail during deployment because Lambda permission statement IDs must be 100 characters or fewer and contain only letters, numbers, hyphens, and underscores. Set statementId to an explicit valid Lambda permission statement ID.`,
						];
					})
			);
		if (lambdaPermissionStatementIdViolations.length > 0) {
			throw new Error(
				`AWS Lambda permission statement ID validation failed:\n${lambdaPermissionStatementIdViolations.map(violation => `- ${violation}`).join('\n')}`
			);
		}

		const elbv2NameViolations = awsElbv2NameInputs.flatMap(({ type }) =>
			mockResources
				.filter(resource => resource.type === type)
				.flatMap(resource => {
					const value = resource.inputs['name'];
					if (typeof value === 'string') {
						if (isAwsElbv2Name(value)) {
							return [];
						}

						return [
							`${type} resource ${JSON.stringify(resource.name)} chooses AWS physical name ${JSON.stringify(value)} from its explicit "name" input. That name is invalid for AWS and will fail during deployment because ELBv2 names must be 32 characters or fewer and contain only letters, numbers, and hyphens.`,
						];
					}

					const implicitNamePrefix = `${resource.name}-`;
					const implicitNameLength =
						implicitNamePrefix.length + pulumiAutoNameRandomSuffixLength;
					if (
						implicitNameLength <= awsElbv2NameMaxLength &&
						awsElbv2NamePattern.test(implicitNamePrefix)
					) {
						return [];
					}

					return [
						`${type} resource ${JSON.stringify(resource.name)} chooses AWS physical name prefix ${JSON.stringify(implicitNamePrefix)} plus ${pulumiAutoNameRandomSuffixLength} random Pulumi auto-name characters because it has no explicit "name" input. That generated name is invalid for AWS and will fail during deployment because ELBv2 names must be 32 characters or fewer and contain only letters, numbers, and hyphens. Set name to an explicit valid ELBv2 name.`,
					];
				})
		);
		if (elbv2NameViolations.length > 0) {
			throw new Error(
				`AWS ELBv2 name validation failed:\n${elbv2NameViolations.map(violation => `- ${violation}`).join('\n')}`
			);
		}

		const ecsTaskDefinitionFamilyViolations =
			awsEcsTaskDefinitionFamilyInputs.flatMap(({ type }) =>
				mockResources
					.filter(resource => resource.type === type)
					.flatMap(resource => {
						const value = resource.inputs['family'];
						if (typeof value === 'string' && isAwsEcsTaskFamilyName(value)) {
							return [];
						}

						return [
							`${type} resource ${JSON.stringify(resource.name)} chooses ECS task definition family ${JSON.stringify(value)}. That name is invalid for AWS and will fail during deployment because ECS task families must be 255 characters or fewer and contain only letters, numbers, hyphens, and underscores.`,
						];
					})
			);
		if (ecsTaskDefinitionFamilyViolations.length > 0) {
			throw new Error(
				`AWS ECS task definition family validation failed:\n${ecsTaskDefinitionFamilyViolations.map(violation => `- ${violation}`).join('\n')}`
			);
		}

		expect(
			mockResources.some(
				resource =>
					resource.name.includes('_minecraft_') &&
					resource.type.startsWith('aws:lb/')
			)
		).toBe(false);

		const minecraftPrivateZone = mockResources.find(
			resource =>
				resource.type === 'aws:route53/zone:Zone' &&
				resource.name.endsWith('_minecraft_private_zone')
		);
		expect(minecraftPrivateZone?.inputs['name']).toBe(
			'internal.minecraft.zemn.me'
		);

		const minecraftCluster = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/cluster:Cluster' &&
				resource.name.endsWith('_minecraft_cluster')
		);
		expect(minecraftCluster?.inputs['name']).toBe(
			'zemn_me_minecraft_production_cluster'
		);

		const minecraftTaskDefinition = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/taskDefinition:TaskDefinition' &&
				resource.name.endsWith('_minecraft_task')
		);
		expect(minecraftTaskDefinition?.inputs['family']).toBe(
			'zemn_me_minecraft_production_task'
		);

		const minecraftService = mockResources.find(
			resource =>
				resource.type === 'aws:ecs/service:Service' &&
				resource.name.endsWith('_minecraft_service')
		);
		expect(minecraftService?.inputs['name']).toBe(
			'zemn_me_minecraft_production_service'
		);

		const minecraftWakeFunction = mockResources.find(
			resource =>
				resource.type === 'aws:lambda/function:Function' &&
				resource.name.endsWith('_minecraft_wake')
		);
		expect(minecraftWakeFunction?.inputs['name']).toBe(
			'zemn_me_minecraft_production_wake'
		);

		const minecraftEventbridgePermission = mockResources.find(
			resource =>
				resource.type === 'aws:lambda/permission:Permission' &&
				resource.name.endsWith('_minecraft_eventbridge_permission')
		);
		expect(minecraftEventbridgePermission?.inputs['statementId']).toBe(
			'monorepo_zemn_me_minecraft_eventbridge_permission'
		);

		const minecraftLogsPermission = mockResources.find(
			resource =>
				resource.type === 'aws:lambda/permission:Permission' &&
				resource.name.endsWith('_minecraft_logs_permission')
		);
		expect(minecraftLogsPermission?.inputs['statementId']).toBe(
			'monorepo_zemn_me_minecraft_logs_permission'
		);

		const minecraftZone = mockResources.find(
			resource =>
				resource.type === 'aws:route53/zone:Zone' &&
				resource.name.endsWith('_minecraft_zone')
		);
		expect(minecraftZone?.inputs['name']).toBe('minecraft.zemn.me');

		const minecraftZoneDelegation = mockResources.find(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.endsWith('_minecraft_zone_delegation')
		);
		expect(minecraftZoneDelegation?.inputs).toMatchObject({
			name: 'minecraft.zemn.me',
			type: 'NS',
		});

		const minecraftPublicRecord = mockResources.find(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.endsWith('_minecraft_public_dns')
		);
		expect(minecraftPublicRecord?.inputs).toMatchObject({
			name: 'minecraft.zemn.me',
			records: ['192.0.2.1'],
			ttl: 30,
			type: 'A',
		});

		const minecraftServerRecord = mockResources.find(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.endsWith('_minecraft_server_dns')
		);
		expect(minecraftServerRecord?.inputs).toMatchObject({
			name: 'server.minecraft.zemn.me',
			records: ['192.0.2.1'],
			ttl: 30,
			type: 'A',
		});

		const minecraftRconRecord = mockResources.find(
			resource =>
				resource.type === 'aws:route53/record:Record' &&
				resource.name.endsWith('_minecraft_rcon_dns')
		);
		expect(minecraftRconRecord?.inputs).toMatchObject({
			name: 'rcon.internal.minecraft.zemn.me',
			records: ['10.42.0.254'],
			ttl: 30,
			type: 'A',
		});

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
		const awsTrustStatement = (sid: string) => {
			const statement = awsTrustStatements[sid];
			expect(statement).toBeDefined();
			if (!statement) {
				throw new Error(`Missing AWS trust statement ${sid}`);
			}
			return statement;
		};
		const submitMainStatement = awsTrustStatement('SubmitMain');
		const stagingMergeQueueStatement = awsTrustStatement('StagingMergeQueue');
		expect(submitMainStatement.Condition.StringEquals).toMatchObject({
			'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
			'token.actions.githubusercontent.com:repository':
				'zemn-me/monorepo',
			'token.actions.githubusercontent.com:repository_id': '275403409',
			'token.actions.githubusercontent.com:workflow': 'Submit',
		});
		expect(submitMainStatement.Condition.StringLike).toEqual({
			'token.actions.githubusercontent.com:ref': 'refs/heads/main',
			'token.actions.githubusercontent.com:sub':
				'repo:zemn-me/monorepo:ref:refs/heads/main',
		});
		expect(stagingMergeQueueStatement.Condition.StringEquals).toMatchObject({
			'token.actions.githubusercontent.com:repository':
				'zemn-me/monorepo',
			'token.actions.githubusercontent.com:repository_id': '275403409',
			'token.actions.githubusercontent.com:workflow': 'Staging',
		});
		expect(stagingMergeQueueStatement.Condition.StringLike).toEqual({
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

		const apiImageLifecyclePolicy = mockResources.find(
			resource =>
				resource.type === 'aws:ecr/lifecyclePolicy:LifecyclePolicy' &&
				resourceInputText(resource.inputs['policy']).includes(
					'Keep recent API images'
				)
		);
		expect(apiImageLifecyclePolicy).toBeDefined();
		const apiImageLifecycle = JSON.parse(
			resourceInputText(apiImageLifecyclePolicy?.inputs['policy'])
		) as EcrLifecyclePolicy;
		expect(apiImageLifecycle.rules).toEqual([
			{
				rulePriority: 1,
				description: 'Keep recent API images',
				selection: {
					tagStatus: 'untagged',
					countType: 'imageCountMoreThan',
					countNumber: 10,
				},
				action: {
					type: 'expire',
				},
			},
		]);
	});
});
