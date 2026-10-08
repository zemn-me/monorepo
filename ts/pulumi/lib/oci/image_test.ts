import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import { OCIImage } from './image.js';

const commands: pulumi.runtime.MockResourceArgs[] = [];
void pulumi.runtime.setMocks({
	newResource: args => {
		if (args.type === 'command:local:Command') commands.push(args);
		return { id: args.name, state: { ...args.inputs, stdout: '' } };
	},
	call: args => args.inputs,
});

test('the provider can run an OCI push from the program runfiles', async () => {
	const directory = mkdtempSync(path.join(tmpdir(), 'oci-runfiles-'));
	try {
		const wrapper = path.join(directory, 'help.sh');
		// Exercise the real generated push and its crane dependency without
		// contacting a registry: --help makes crane exit before uploading.
		writeFileSync(wrapper, '#!/bin/sh\nexec "$TEST_PUSH" --help "$@"\n', {
			mode: 0o755,
		});
		const image = new OCIImage('runfiles_test', {
			push: wrapper,
			repository: 'example.invalid/not-uploaded',
			digest: `sha256:${'0'.repeat(64)}`,
		});
		await new Promise<void>(resolve => image.uri.apply(() => resolve()));

		// bazel test supplies these variables, but bazel run of our js_binary
		// deployment launcher supplies JS_BINARY__RUNFILES instead. Remove the
		// test-only context while Pulumi constructs the provider's RPC inputs.
		expect(process.env['JS_BINARY__RUNFILES']).toBeTruthy();
		const savedEnvironment = { ...process.env };
		try {
			for (const key of [
				'RUNFILES_DIR',
				'RUNFILES_MANIFEST_FILE',
				'JAVA_RUNFILES',
				'TEST_SRCDIR',
			]) {
				delete process.env[key];
			}
			const launcherImage = new OCIImage('launcher_test', {
				push: wrapper,
				repository: 'example.invalid/not-uploaded',
				digest: `sha256:${'0'.repeat(64)}`,
			});
			await new Promise<void>(resolve =>
				launcherImage.uri.apply(() => resolve())
			);
		} finally {
			process.env = savedEnvironment;
		}
		const failingPush = path.join(directory, 'failed.sh');
		writeFileSync(
			failingPush,
			'#!/bin/sh\necho "push failed" >&2\nexit 23\n',
			{
				mode: 0o755,
			}
		);
		new OCIImage('failed_test', {
			push: failingPush,
			repository: 'example.invalid/not-uploaded',
			digest: `sha256:${'0'.repeat(64)}`,
		});
		await pulumi.runtime.disconnect();
		expect(commands).toHaveLength(3);
		for (const name of ['runfiles_test_push', 'launcher_test_push']) {
			const command = commands.find(item => item.name === name)!;
			const [executable, ...args] = command.inputs[
				'interpreter'
			] as string[];
			// The provider process does not inherit environment changes made by
			// the Node program's Bazel launcher; only explicit inputs cross RPC.
			for (const lifecycle of ['create', 'update']) {
				const body = command.inputs[lifecycle];
				expect(typeof body).toBe('string');
				const result = spawnSync(
					executable!,
					[...args, body as string],
					{
						env: {
							PATH: process.env.PATH,
							TEST_PUSH: path.resolve(process.env['TEST_PUSH']!),
							...(command.inputs['environment'] as Record<
								string,
								string
							>),
						},
						encoding: 'utf8',
					}
				);
				expect({
					status: result.status,
					stderr: result.stderr,
				}).toEqual({
					status: 0,
					stderr: expect.stringContaining('Usage:'),
				});
				expect(result.stderr).toContain('Usage:');
				expect(result.stderr).not.toContain('cannot find');
				expect(result.stdout.trim()).toBe(
					`example.invalid/not-uploaded@sha256:${'0'.repeat(64)}`
				);
			}
		}
		const failure = commands.find(
			item => item.name === 'failed_test_push'
		)!;
		const [failureExecutable, ...failureArgs] = failure.inputs[
			'interpreter'
		] as string[];
		const failed = spawnSync(failureExecutable!, failureArgs, {
			encoding: 'utf8',
		});
		expect(failed.status).toBe(23);
		expect(failed.stderr).toContain('push failed');
		expect(failed.stdout).toBe('');
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
