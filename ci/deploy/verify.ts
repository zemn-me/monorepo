import assert from 'node:assert/strict';
import { type ExecException, execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { runfiles } from '@bazel/runfiles';

import { pulumiCommand } from '#root/ts/pulumi/cli.js';

const exec = promisify(execFile);

export async function verifyBundle(home: string) {
	const { command } = await pulumiCommand();
	const run = (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
		exec(command, args, { cwd, env: { ...process.env, ...env } });
	const versions = JSON.parse(
		await readFile(path.join(home, 'plugins', 'versions.json'), 'utf8')
	) as Record<string, string>;
	const checkpointVersions = JSON.parse(
		await readFile(
			runfiles.resolveWorkspaceRelative(
				'bzl/pulumi_providers/checkpoint_versions.json'
			),
			'utf8'
		)
	) as Record<string, string[]>;
	const { stdout } = await run(['plugin', 'ls', '--json'], home, {});
	const installed = JSON.parse(stdout) as {
		kind: string;
		name: string;
		version: string;
	}[];

	for (const [name, retained] of Object.entries(checkpointVersions)) {
		for (const version of new Set([versions[name], ...retained])) {
			assert(
				installed.some(
					p => p.kind === 'resource' && p.name === name && p.version === version
				),
				`Bundle is missing ${name}@${version}`
			);
			await run(
				['package', 'info', `${name}@${version}`],
				process.cwd(),
				{ PULUMI_DISABLE_REGISTRY_RESOLVE: 'true' }
			);
		}
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
		(error: ExecException) =>
			error.code === 1 &&
			[error.stdout, error.stderr].some(output =>
				output?.includes(
					"no resource plugin 'pulumi-resource-random' found in the workspace at version v0.0.0-missing"
				)
			)
	);
}
