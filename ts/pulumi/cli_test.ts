import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@jest/globals';
import { LocalWorkspace } from '@pulumi/pulumi/automation/index.js';

import { pulumiCommand } from '#root/ts/pulumi/cli.js';

test('Automation API uses the Bazel CLI even with a broken host pulumi', async () => {
	const directory = await mkdtemp(
		path.join(process.env['TEST_TMPDIR'] ?? tmpdir(), 'pulumi-cli-')
	);
	const originalPath = process.env.PATH;
	try {
		await writeFile(
			path.join(directory, 'pulumi'),
			'#!/bin/sh\nexit 99\n',
			{ mode: 0o755 }
		);
		process.env.PATH = directory;
		const cli = await pulumiCommand();
		expect(path.isAbsolute(cli.command)).toBe(true);
		await access(
			path.join(path.dirname(cli.command), 'pulumi-language-nodejs')
		);
		await access(
			path.join(
				path.dirname(cli.command),
				'pulumi-resource-pulumi-nodejs'
			)
		);
		const workspace = await LocalWorkspace.create({
			workDir: directory,
			pulumiCommand: cli,
		});
		expect(workspace.pulumiCommand.command).toBe(cli.command);
		expect(workspace.pulumiVersion).toBe(cli.version?.toString());
	} finally {
		if (originalPath === undefined) delete process.env.PATH;
		else process.env.PATH = originalPath;
		await rm(directory, { recursive: true, force: true });
	}
});
