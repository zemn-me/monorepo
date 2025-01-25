
import { runfiles } from "@bazel/runfiles";
import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";
import { FileAsset } from "@pulumi/pulumi/asset";


export interface CopybaraArgs {
	config: Input<FileAsset>
}

const COPYBARA_RLOCATIONPATH =
	runfiles.resolve("copybara/java/com/google/copybara/copybara");

/**
 * Represents an OCI [Docker-like] image uploaded to an arbitrary remote OCI
 * repository such as AWS ECR.
 */
export class Copybara extends ComponentResource {
	/**
	 * URI uniquely identifying the image as landed in the repo.
	 */
	uri: Output<string>
	constructor(
		name: string,
		args: CopybaraArgs,
		opts?: ComponentResourceOptions
	) {
		super("ts:pulumi:lib:copybara:copybara",
			name, args, opts,
		);

		const upload = new local.Command(`${name}_run`, {
			/*
			 todo --
			environment: output(authFile).apply(f => ({
				DOCKER_CONFIG: f,
			}) as { [v: string]: string }),
			 */
			interpreter: [
				COPYBARA_RLOCATIONPATH,
				output(args.config).apply(c => c.path)
			],
		}, { parent: this });

		this.uri = upload.stdout;

		this.registerOutputs({ upload });
	}
}
