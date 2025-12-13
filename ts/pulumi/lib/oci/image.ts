import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
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
	private static require = createRequire(import.meta.url);
	private static resolveRunfilesEnv(runfile: string): Record<string, string> {
		try {
			// @bazel/runfiles is present when executed from Bazel-built code.
			const { create } = OCIImage.require("@bazel/runfiles") as typeof import("@bazel/runfiles");
			const r = create();
			const env: Record<string, string> = {};

			const manifest = r.rlocation(`${runfile}.runfiles_manifest`);
			if (manifest && existsSync(manifest)) env.RUNFILES_MANIFEST_FILE = manifest;

			const dir = r.rlocation(`${runfile}.runfiles`);
			if (dir && existsSync(dir)) env.RUNFILES_DIR = dir;

			return env;
		} catch {
			return {};
		}
	}

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
			environment: all([output(authFile), args.push]).apply(([authPath, pushPath]) => {
				const env: { [v: string]: string } = {};
				if (authPath) env.DOCKER_CONFIG = authPath;

				// Resolve runfiles information for the push shim when Pulumi is running outside Bazel.
				if (pushPath) {
					Object.assign(env, OCIImage.resolveRunfilesEnv(pushPath));
					// If runfiles lib failed, fall back to best-effort relative paths.
					if (!env.RUNFILES_DIR) {
						const dir = path.resolve(`${pushPath}.runfiles`);
						if (existsSync(dir)) env.RUNFILES_DIR = dir;
					}
					if (!env.RUNFILES_MANIFEST_FILE) {
						const manifest = path.resolve(`${pushPath}.runfiles_manifest`);
						if (existsSync(manifest)) env.RUNFILES_MANIFEST_FILE = manifest;
					}
				}

				// Preserve Bazel runfiles context if present in the current process.
				for (const key of ["RUNFILES_DIR", "RUNFILES_MANIFEST_FILE", "JAVA_RUNFILES", "PATH"]) {
					const value = process.env[key];
					if (value) env[key] = value;
				}

				return env;
			}),
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
