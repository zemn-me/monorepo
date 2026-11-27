import { LocalWorkspace, Stack } from '@pulumi/pulumi/automation/index.js';

import { pulumiCommand } from '#root/ts/pulumi/cli.js';
import * as monorepo from '#root/ts/pulumi/index.js';

export async function program() {
	// biome-ignore lint/style/noCommonJs: this needs runtime require
	require('ts/pulumi/index');
}

export const projectName = 'monorepo-2';

async function provisionStack(s: Promise<Stack>): Promise<Stack> {
	await (await s).setConfig('aws:region', { value: 'us-east-1' });

	return s;
}

const baseComponentName = 'monorepo';

// OpenAI creates these resources outside Pulumi, but their non-secret IDs are
// versioned here so each stack's Lambda configuration remains reproducible.
const openAIIdentityProviderId = 'idp_XmRQyI2VtPZzqhhsRZB2GqPx';
const openAIServiceAccountIds = {
	production: 'user-32T4FdsHhAxxKLlLPgRjWfFU',
	staging: 'user-uPqLgRuopbBeGjM1R98zxgky',
} as const;

function openAIWorkloadIdentityConfig(
	environment: keyof typeof openAIServiceAccountIds
) {
	return {
		identityProviderId: openAIIdentityProviderId,
		serviceAccountId: openAIServiceAccountIds[environment],
	};
}

function exportOpenAIWorkloadIdentityOutputs(component: monorepo.Component) {
	return {
		journalWorkerRoleArn: component.journalWorkerRoleArn,
		openAIWorkloadIdentityAudience:
			component.openAIWorkloadIdentityAudience,
		...(component.openAIWorkloadIdentityIssuer === undefined
			? {}
			: {
					openAIWorkloadIdentityIssuer:
						component.openAIWorkloadIdentityIssuer,
				}),
	};
}

export async function production(): Promise<Stack> {
	return provisionStack(
		LocalWorkspace.createOrSelectStack(
			{
				stackName: 'prod',
				projectName,
				async program() {
					const openAI = openAIWorkloadIdentityConfig('production');
					const component = new monorepo.Component(
						baseComponentName,
						{
							staging: false,
							openAIIdentityProviderId: openAI.identityProviderId,
							openAIServiceAccountId: openAI.serviceAccountId,
						}
					);
					return exportOpenAIWorkloadIdentityOutputs(component);
				},
			},
			{ pulumiCommand: await pulumiCommand() }
		)
	);
}

export async function staging(): Promise<Stack> {
	return provisionStack(
		LocalWorkspace.createOrSelectStack(
			{
				stackName: 'staging',
				projectName,
				async program() {
					const openAI = openAIWorkloadIdentityConfig('staging');
					const component = new monorepo.Component(
						baseComponentName,
						{
							staging: true,
							openAIIdentityProviderId: openAI.identityProviderId,
							openAIServiceAccountId: openAI.serviceAccountId,
						}
					);
					return exportOpenAIWorkloadIdentityOutputs(component);
				},
			},
			{ pulumiCommand: await pulumiCommand() }
		)
	);
}
