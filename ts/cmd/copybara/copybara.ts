import { runfiles } from "@bazel/runfiles";

import { isDefined, must } from "#root/ts/guard.js";

export const copybaraBin = runfiles.resolve(
	must(isDefined)(
		"copybara/java/com/google/copybara/copybara"
	)
)
