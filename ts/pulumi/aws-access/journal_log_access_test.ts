import { beforeEach, expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import {
	createJournalLogAccess,
	type JournalLogAccessConfig,
} from './journal_log_access.js';

const resources: pulumi.runtime.MockResourceArgs[] = [];
void pulumi.runtime.setMocks({
	newResource(args) {
		resources.push(args);
		return {
			id: `${args.name}-id`,
			state: {
				...args.inputs,
				arn: `arn:aws:sso:::permissionSet/ssoins-0000000000000000/ps-0000000000000000`,
			},
		};
	},
	call(args) {
		throw new Error(`Unexpected AWS lookup: ${args.token}`);
	},
});

// Synthetic fixture IDs; never used in either deployed stack.
const config: JournalLogAccessConfig = {
	homeRegion: 'us-east-1',
	instanceArn: 'arn:aws:sso:::instance/ssoins-0000000000000000',
	groupId: '00000000-0000-0000-0000-000000000000',
};

beforeEach(() => {
	resources.splice(0);
});

test('unconfigured production creates no provider, permission set, or assignment', async () => {
	expect(
		createJournalLogAccess('disabled', { staging: false })
	).toBeUndefined();
	await pulumi.runtime.disconnect();
	expect(resources).toEqual([]);
});

test('staging ignores even a supplied production assignment', async () => {
	expect(
		createJournalLogAccess('staging', { staging: true, assignment: config })
	).toBeUndefined();
	await pulumi.runtime.disconnect();
	expect(resources).toEqual([]);
});

test('configured production grants only approved log access to the exact group and account', async () => {
	createJournalLogAccess('configured', {
		staging: false,
		assignment: config,
	});
	await pulumi.runtime.disconnect();
	expect(resources.map(resource => resource.type).sort()).toEqual([
		'aws:ssoadmin/accountAssignment:AccountAssignment',
		'aws:ssoadmin/permissionSet:PermissionSet',
		'aws:ssoadmin/permissionSetInlinePolicy:PermissionSetInlinePolicy',
		'pulumi:providers:aws',
	]);
	expect(
		resources.find(resource => resource.type === 'pulumi:providers:aws')
			?.inputs['region']
	).toBe('us-east-1');
	const permissionSet = resources.find(
		resource => resource.type === 'aws:ssoadmin/permissionSet:PermissionSet'
	);
	expect(permissionSet?.inputs).toEqual({
		instanceArn: config.instanceArn,
		name: 'JournalLogReader',
		description: 'Read explicitly approved journal and API Lambda logs',
		sessionDuration: 'PT1H',
	});
	const policy = resources.find(
		resource =>
			resource.type ===
			'aws:ssoadmin/permissionSetInlinePolicy:PermissionSetInlinePolicy'
	);
	expect(policy?.inputs['instanceArn']).toBe(config.instanceArn);
	expect(JSON.parse(policy?.inputs['inlinePolicy'])).toEqual({
		Version: '2012-10-17',
		Statement: [
			{
				Sid: 'ReadJournalLogs',
				Effect: 'Allow',
				Action: ['logs:DescribeLogStreams', 'logs:FilterLogEvents'],
				Resource: [
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalcuratorlambda-2c615cc',
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalcuratorlambda-f57487f',
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalworkerlambda-075035b',
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/journalworkerlambda-3c8d0f8',
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/apizemnmelambdafunction-ffe7324',
					'arn:aws:logs:us-east-1:658613637108:log-group:/aws/lambda/apizemnmelambdafunction-759d819',
				],
			},
		],
	});
	const assignment = resources.find(
		resource =>
			resource.type === 'aws:ssoadmin/accountAssignment:AccountAssignment'
	);
	expect(assignment?.inputs).toEqual({
		instanceArn: config.instanceArn,
		permissionSetArn:
			'arn:aws:sso:::permissionSet/ssoins-0000000000000000/ps-0000000000000000',
		principalId: config.groupId,
		principalType: 'GROUP',
		targetId: '658613637108',
		targetType: 'AWS_ACCOUNT',
	});
});

test('rejects an account instance before registering any AWS resource', () => {
	expect(() =>
		createJournalLogAccess('invalid', {
			staging: false,
			assignment: {
				...config,
				instanceArn: 'arn:aws:sso:::instance/ins-0000000000000000',
			},
		})
	).toThrow('organization instance ARN');
	expect(resources).toEqual([]);
});

test('rejects a display name instead of a verified group ID', () => {
	expect(() =>
		createJournalLogAccess('invalid-group', {
			staging: false,
			assignment: { ...config, groupId: 'dot-operator' },
		})
	).toThrow('Identity Store group ID');
	expect(resources).toEqual([]);
});
