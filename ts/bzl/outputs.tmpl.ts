import { runfiles } from "@bazel/runfiles";


export const _VAR_NAME =
	`__OUTPUTS`.split(" ")
	.map(v => runfiles.resolve(v));
