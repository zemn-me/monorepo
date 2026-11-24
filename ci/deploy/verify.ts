import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { pulumiCommand } from '#root/ts/pulumi/cli.js';

const exec = promisify(execFile);

export async function verifyBundle(home: string) {
	const { command } = await pulumiCommand();
	const run = (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
		exec(command, args, { cwd, env: { ...process.env, ...env } });
	const versions = JSON.parse(
		await readFile(path.join(home, 'plugins', 'versions.json'), 'utf8')
	) as Record<string, string>;

	for (const [name, version] of Object.entries(versions)) {
		await run(
			['package', 'info', `${name}@${version}`],
			process.cwd(),
			{
				PULUMI_DISABLE_REGISTRY_RESOLVE: 'true',
			}
		);
	}

	// A checkpoint can reference a provider older than the current SDK.
	// A real preview must reject an absent version before starting that provider.
	await writeFile(
		path.join(home, 'Pulumi.yaml'),
		`name: provider-check
runtime: yaml
resources:
  pet:
    type: random:RandomPet
    options:
      version: 0.0.0-missing
`
	);
	const env = {
		PULUMI_BACKEND_URL: pathToFileURL(home).href,
		PULUMI_CONFIG_PASSPHRASE: 'bundle-test',
	};
	await run(['stack', 'init', 'dev'], home, env);
	await assert.rejects(
		run(['preview', '--stack', 'dev'], home, env),
		/no resource plugin 'pulumi-resource-random' found in the workspace at version v0\.0\.0-missing/
	);
}
