import { runfiles } from '@bazel/runfiles';
import { PulumiCommand } from '@pulumi/pulumi/automation/index.js';

/** Use Bazel's checksum-pinned CLI and bundled language plugins, never PATH. */
export function pulumiCommand(): Promise<PulumiCommand> {
	return PulumiCommand.get({
		root: runfiles.resolveWorkspaceRelative(
			'bin/linux/pulumi/installation'
		),
	});
}
