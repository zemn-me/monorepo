import fs from 'node:fs';
import path from 'node:path';

import { LocalWorkspace, Stack } from '@pulumi/pulumi/automation.js';

import * as monorepo from '#root/ts/pulumi/index.js';

// inject the pulumi binary into process.env; it is used by the pulumi automation API

const pulumi_dir = path.join(process.cwd(), 'ts/pulumi');
const pulumi_binary_path = path.join(pulumi_dir, 'pulumi');

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
	require('ts/pulumi/index');
}

export const projectName = 'monorepo-2';

async function provisionStack(s: Promise<Stack>): Promise<Stack> {
	await (await s).workspace.installPlugin('aws', 'v5.13.0'); // can I get rid of this? it seems stupid
	await (await s).setConfig('aws:region', { value: 'us-east-1' });

	return s;
}

const baseComponentName = 'monorepo';

export async function production(): Promise<Stack> {
	return provisionStack(
		LocalWorkspace.createOrSelectStack({
			stackName: 'prod',
			projectName,
			async program() {
				new monorepo.Component(baseComponentName, { staging: false });
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
				new monorepo.Component(baseComponentName, { staging: true });
			},
		})
	);
}
