import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runfiles } from '@bazel/runfiles';

import deployToStaging from '#root/ts/pulumi/deploy_to_staging.js';
import { verifyStagingApiEdge } from './api_edge.js';
import { deployToProduction } from './production.js';
import { verifyBundle } from './verify.js';

// The staging workflow launches two different revisions with the same shell
// wrapper. Each bundle supplies its own providers and workspace.
const plugins = runfiles.resolveWorkspaceRelative('bin/linux/pulumi/providers');
const home = await mkdtemp(path.join(tmpdir(), 'pulumi-deploy-'));
try {
	await symlink(plugins, path.join(home, 'plugins'), 'dir');
	process.env.PULUMI_HOME = home;
	const revision = process.argv[2];
	switch (revision) {
		case 'verify':
			await verifyBundle(home);
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
			if (revision === 'candidate') await verifyStagingApiEdge();
			break;
		default:
			throw new Error('Expected main, candidate, production, or verify');
	}
} finally {
	await rm(home, { recursive: true, force: true });
}
