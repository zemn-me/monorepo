import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

/** Non-secret identifiers recorded after owner-approved Identity Center setup. */
export interface JournalLogAccessConfig {
	homeRegion: aws.Region;
	instanceArn: string;
	groupId: string;
}

const accountId = '658613637108';

// Keep replacements explicit: a new function must not silently inherit access.
const journalLogGroups = [
	'journalcuratorlambda-2c615cc',
	'journalcuratorlambda-f57487f',
	'journalworkerlambda-075035b',
	'journalworkerlambda-3c8d0f8',
	'apizemnmelambdafunction-ffe7324',
	'apizemnmelambdafunction-759d819',
] as const;

/** Shared access belongs to production and requires explicit verified IDs. */
export function createJournalLogAccess(
	name: string,
	args: { staging: boolean; assignment?: JournalLogAccessConfig },
	opts?: pulumi.ComponentResourceOptions
) {
	if (args.staging || args.assignment === undefined) return;

	const { homeRegion, instanceArn, groupId } = args.assignment;
	if (!/^arn:aws:sso:::instance\/ssoins-[a-zA-Z0-9]{16}$/.test(instanceArn)) {
		throw new Error(
			'Journal log access requires an organization instance ARN'
		);
	}
	if (
		!/^([0-9a-f]{10}-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
			groupId
		)
	) {
		throw new Error(
			'Journal log access requires a verified Identity Store group ID'
		);
	}

	const provider = new aws.Provider(
		`${name}_identity_center`,
		{ region: homeRegion },
		{ parent: opts?.parent }
	);
	const resourceOpts = { parent: opts?.parent, provider };
	const permissionSet = new aws.ssoadmin.PermissionSet(
		`${name}_permission_set`,
		{
			instanceArn,
			name: 'JournalLogReader',
			description: 'Read explicitly approved journal and API Lambda logs',
			sessionDuration: 'PT1H',
		},
		resourceOpts
	);
	const inlinePolicy = new aws.ssoadmin.PermissionSetInlinePolicy(
		`${name}_policy`,
		{
			instanceArn,
			permissionSetArn: permissionSet.arn,
			inlinePolicy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [
					{
						Sid: 'ReadJournalLogs',
						Effect: 'Allow',
						Action: [
							'logs:DescribeLogStreams',
							'logs:FilterLogEvents',
						],
						Resource: journalLogGroups.map(
							group =>
								`arn:aws:logs:us-east-1:${accountId}:log-group:/aws/lambda/${group}`
						),
					},
				],
			}),
		},
		resourceOpts
	);
	const assignment = new aws.ssoadmin.AccountAssignment(
		`${name}_assignment`,
		{
			instanceArn,
			permissionSetArn: permissionSet.arn,
			principalId: groupId,
			principalType: 'GROUP',
			targetId: accountId,
			targetType: 'AWS_ACCOUNT',
		},
		{ ...resourceOpts, dependsOn: [inlinePolicy] }
	);

	return { permissionSet, inlinePolicy, assignment };
}
