import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runfiles } from '@bazel/runfiles';

import deployToStaging from '#root/ts/pulumi/deploy_to_staging.js';
import { deployToProduction } from './production.js';
import { verifyProviders } from './verify.js';

async function main() {
	const plugins = runfiles.resolveWorkspaceRelative(
		'bin/linux/pulumi/providers'
	);
	const home = await mkdtemp(path.join(tmpdir(), 'pulumi-deploy-'));
	try {
		await symlink(plugins, path.join(home, 'plugins'), 'dir');
		process.env.PULUMI_HOME = home;
		const revision = process.argv[2];
		switch (revision) {
			case 'verify':
				await verifyProviders(home);
				break;
			case 'production':
				await deployToProduction();
				break;
			case 'main':
			case 'candidate':
				await deployToStaging({
					doNotTearDown: true,
					overwrite: revision === 'main',
					skipRefresh: revision === 'candidate',
				});
				break;
			default:
				throw new Error(
					'Expected main, candidate, production, or verify'
				);
		}
	} finally {
		await rm(home, { recursive: true, force: true });
	}
}

await main().catch(error => {
	// Pulumi may handle uncaught exceptions without setting a failing exit status.
	process.exitCode = 1;
	// biome-ignore lint/suspicious/noConsole: surface the deployment error in Actions
	console.error(error);
});
