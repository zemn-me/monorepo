import { runfiles } from "@bazel/runfiles";

import { isDefined, must } from "#root/ts/guard.js";

export const copybaraBin = runfiles.resolveWorkspaceRelative(
	must(isDefined)(
		"copybara/java/com/google/copybara/copybara.jar"
	)
)
