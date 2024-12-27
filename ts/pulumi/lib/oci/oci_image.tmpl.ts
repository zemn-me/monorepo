import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { resolve } from 'node:path';

import { local } from '@pulumi/command';
import { all, ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
	token?: Input<string|undefined>
}

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
    },
  };

	const fileContent = JSON.stringify(authData)

  const hash = createHash('sha256').update(fileContent).digest('hex');

  // Generate a temporary file path
  const tempDir = tmpdir();
  const randomName = `${hash}.json`;
  const filePath = path.join(tempDir, randomName);

  // Write the JSON data to the file
  await writeFile(filePath, JSON.stringify(authData));

  // Return the path to the newly created temporary file
  return resolve(filePath)
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
			return createPodmanAuthFile(registry, token)
		});

		const upload = new local.Command(`${name}_push`, {
			environment: output(authFile).apply(f => ({
				REGISTRY_AUTH_FILE: f
			})as {[v: string]: string}),
			interpreter:
				arg.apply(arg => [
				"__PUSH_BIN",
				...arg
			])
		}, { parent: this })

		this.url = upload.stdout


		super.registerOutputs({ upload })
	}


}
