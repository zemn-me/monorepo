import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { local } from '@pulumi/command';
import { all, ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";


export interface OciImageArgs {
	/**
	 * The container repo to upload to.
	 */
	repository: Input<string>
	/**
	 * Token used to auth to the repo.
	 */
	token?: Input<string|undefined>
	/**
	 * Executable used to push the image — expected to be output of oci_push rule.
	 */
	push: Input<string>
	/**
	 * Digest uniquely identifying the image.
	 */
	digest: Input<string>
}

/**
 * Filename picked up by crane when discovering
 * the auth file.
 */
const authConfigFilename = "config.json"

interface ImageAuthObject {
	auths: {
		[uri: string]: {
			auth: string
		}
	}
}

/**
 * Creates a standard "config.json" file that can be picked up by Crane,
 * PodMan, Docker etc.
 *
 * The config.json is placed in a temporary directory, and the directory path
 * is returned.
 */
async function createImageAuthFile(
	/**
	 * Auth token.
	 */
	token: string,
	/**
	 * Registry to auth to.
	 */
	registry: string
): Promise<string> {
	const authData: ImageAuthObject = {
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

	const tempDir = tmpdir();
	const contentBasedDirName = hash;
	const configDir = path.join(tempDir, contentBasedDirName);
	await mkdir(configDir)
	const filePath = path.join(configDir, authConfigFilename);

	await writeFile(filePath, JSON.stringify(authData));

	return path.resolve(configDir)
}

/**
 * Represents an OCI [Docker-like] image uploaded to an arbitrary remote OCI
 * repository such as AWS ECR.
 */
export class OCIImage extends ComponentResource {
	/**
	 * URI uniquely identifying the image as landed in the repo.
	 */
	uri: Output<string>
	constructor(
		name: string,
		args: OciImageArgs,
		opts?: ComponentResourceOptions
	) {
		super("ts:pulumi:lib:oci:ociimage",
			name, args, opts,
		);

		const authFile = all([args.token, args.repository]).apply(([token, registry]) => {
			if (!token || !registry) return;
			return createImageAuthFile(token, registry)
		});

		const upload = new local.Command(`${name}_push`, {
			environment: output(authFile).apply(f => ({
				DOCKER_CONFIG: f,
			}) as { [v: string]: string }),
			interpreter: [
				args.push,
				"--repository",
				args.repository
			],
			triggers: [ args.digest ]
		}, { parent: this });

		this.uri = upload.stdout;

		this.registerOutputs({ upload });
	}
}
