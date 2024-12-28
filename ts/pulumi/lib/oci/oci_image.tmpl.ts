import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { resolve } from 'node:path';

import { local } from '@pulumi/command';
import { all, ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
	token?: Input<string | undefined>
}

const imgAuthConfigFilename = "config.json";

export async function createPodmanAuthFile(
	token: string,
	registry: string
): Promise<string> {
	// Encode credentials

	// Build the auth.json structure
	const authData = {
		auths: {
			[`https://${registry}`]: {
				auth: token
			},
			// i dont know which is right so im just trying both
			[`${registry}`]: {
				auth: token
			},
		},
	};

	const fileContent = JSON.stringify(authData)

	const hash = createHash('sha256').update(fileContent).digest('hex');

	// Generate a temporary file path
	const tempDir = tmpdir();
	const contentBasedDirName = hash;
	const configDir = path.join(tempDir, contentBasedDirName);
	await mkdir(configDir)
	const filePath = path.join(configDir, imgAuthConfigFilename);

	// Write the JSON data to the file
	await writeFile(filePath, JSON.stringify(authData));

	// Return the path to the newly created temporary file
	return resolve(configDir)
}

export class __ClassName extends ComponentResource {
	url: Output<string>
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const arg = all([args.repository]).apply(([repo]) => [
			"--repository", `${repo}`
		])

		const authFile = all([args.token, args.repository]).apply(([token, registry]) => {
			if (!token || !registry) return;
			return createPodmanAuthFile(token, registry)
		});

		const upload = new local.Command(`${name}_push`, {
			environment: output(authFile).apply(f => ({
				DOCKER_CONFIG: f,
				// not supported yet by crane --
				// supported from v0.20.2
				// https://github.com/google/go-containerregistry/releases/tag/v0.20.2
				//
				// rules_oci uses v0.18.x
				// https://github.com/bazel-contrib/rules_oci/blob/843eb01b152b884fe731a3fb4431b738ad00ea60/oci/private/versions.bzl#L3
				//REGISTRY_AUTH_FILE: f
			}) as { [v: string]: string }),
			interpreter:
				arg.apply(arg => [
					"__PUSH_BIN",
					"-v",
					...arg
				])
		}, { parent: this })

		this.url = upload.stdout


		super.registerOutputs({ upload })
	}


}
