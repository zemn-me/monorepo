import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { local } from '@pulumi/command';
import {
	all,
	ComponentResource,
	ComponentResourceOptions,
	Input,
	Output,
} from '@pulumi/pulumi';

export interface NpmPackageArgs {
	/** Deterministic archive used to decide whether the package changed. */
	archive: string;
	/** npm package name. */
	packageName: Input<string>;
	/** Bazel-built package directory passed to npm publish. */
	packageDirectory: Input<string>;
	/** Executable which runs npm publish with the repository-pinned npm. */
	publish: Input<string>;
	/** File containing the package's generated semantic version. */
	versionFile: string;
}

function publishInterpreter(
	packageName: Input<string>,
	packageDirectory: Input<string>,
	version: string,
	publish: Input<string>
): Output<string[]> {
	return all([packageName, packageDirectory, publish]).apply(
		([packageName, packageDirectory, publish]) => [
			'sh',
			'-c',
			[
				'set -eu',
				'package_name="$1"',
				'package_directory="$2"',
				'version="${3#v}"',
				'publisher="$4"',
				'npm_cache="$(mktemp -d)"',
				"trap 'rm -rf \"$npm_cache\"' EXIT",
				'export NPM_CONFIG_CACHE="$npm_cache"',
				'registry_url="https://registry.npmjs.org/${package_name}/${version}"',
				'if curl --fail --silent --show-error "$registry_url" >/dev/null 2>&1; then',
				'  printf "%s@%s is already published\\n" "$package_name" "$version"',
				'  exit 0',
				'fi',
				'exec "$publisher" "$package_directory"',
			].join('\n'),
			'--',
			packageName,
			packageDirectory,
			version,
			publish,
		]
	);
}

/**
 * Publishes a Bazel-built npm package when its deterministic archive changes.
 *
 * The registry lookup makes creation and retries idempotent if npm accepted a
 * version before Pulumi recorded the successful update.
 */
export class NpmPackage extends ComponentResource {
	constructor(
		name: string,
		args: NpmPackageArgs,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:npm:NpmPackage', name, args, opts);

		const digest = createHash('sha256')
			.update(readFileSync(args.archive))
			.digest('hex');
		const version = readFileSync(args.versionFile, 'utf8').trim();

		const publish = new local.Command(
			`${name}_publish`,
			{
				environment: {
					NPM_CONFIG_PROVENANCE: 'true',
				},
				interpreter: publishInterpreter(
					args.packageName,
					args.packageDirectory,
					version,
					args.publish
				),
				triggers: [digest],
			},
			{ parent: this }
		);

		this.registerOutputs({
			digest,
			publish,
			version,
		});
	}
}
