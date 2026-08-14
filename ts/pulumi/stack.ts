import fs from 'node:fs';
import path from 'node:path';

import * as Pulumi from '@pulumi/pulumi';
import { LocalWorkspace, Stack } from '@pulumi/pulumi/automation/index.js';

import * as monorepo from '#root/ts/pulumi/index.js';

// inject the pulumi binary into process.env; it is used by the pulumi automation API

const pulumi_dir = path.join(process.cwd(), 'ts/pulumi');
const pulumi_binary_path = path.join(pulumi_dir, 'pulumi_bin');

process.env.PATH = [
	process.env.PATH,
	// the pulumi cli binary should be here
	pulumi_dir,
].join(':');

// check the binary is actually in there
if (!fs.existsSync(pulumi_binary_path)) {
	throw new Error('missing pulumi binary in ' + pulumi_dir);
}

export async function program() {
	// biome-ignore lint/style/noCommonJs: this needs runtime require
	require('ts/pulumi/index');
}

export const projectName = 'monorepo-2';

async function provisionStack(s: Promise<Stack>): Promise<Stack> {
	await (await s).workspace.installPlugin('aws', 'v7.41.0');
	await (await s).setConfig('aws:region', { value: 'us-east-1' });

	return s;
}

const baseComponentName = 'monorepo';

function openAIWorkloadIdentityConfig() {
	const config = new Pulumi.Config('openai');
	const identityProviderId = config.get('identityProviderId');
	const serviceAccountId = config.get('serviceAccountId');
	if (
		(identityProviderId === undefined) !==
		(serviceAccountId === undefined)
	) {
		throw new Error(
			'openai:identityProviderId and openai:serviceAccountId must be configured together'
		);
	}
	return { identityProviderId, serviceAccountId };
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
		LocalWorkspace.createOrSelectStack({
			stackName: 'prod',
			projectName,
			async program() {
				const openAI = openAIWorkloadIdentityConfig();
				const component = new monorepo.Component(baseComponentName, {
					staging: false,
					openAIIdentityProviderId: openAI.identityProviderId,
					openAIServiceAccountId: openAI.serviceAccountId,
				});
				return exportOpenAIWorkloadIdentityOutputs(component);
			},
		})
	);
}

export async function staging(): Promise<Stack> {
	return provisionStack(
		LocalWorkspace.createOrSelectStack({
			stackName: 'staging',
			projectName,
			async program() {
				const openAI = openAIWorkloadIdentityConfig();
				const component = new monorepo.Component(baseComponentName, {
					staging: true,
					openAIIdentityProviderId: openAI.identityProviderId,
					openAIServiceAccountId: openAI.serviceAccountId,
				});
				return exportOpenAIWorkloadIdentityOutputs(component);
			},
		})
	);
}
