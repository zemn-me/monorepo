import * as bazel from '#root/ci/bazel.js';

async function* text(s: string) {
	for (const line of s.split('\n')) {
		yield line;
	}
}

const feed =
	(f: (s: AsyncGenerator<string>) => AsyncGenerator<string>) =>
	async (s: string) =>
		(await toArray(f(text(s)))).join('\n');

const annotate = feed(bazel.AnnotateBazelLines);

it('should notice a reproducible build / cache error', async () => {
	await expect(
		annotate(
			`
/home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/bazel_tools/tools/build_defs/repo/http.bzl:369:31: in <toplevel>

  WARNING: Fetching from distroless/base@latest without an integrity hash. The result will not be cached.

  WARNING: For reproducible builds, a digest is recommended.
  Either set 'reproducible = False' to silence this warning, or run the following command to change oci.pull to use a digest:
  (make sure you use a recent buildozer release with MODULE.bazel support)

  buildozer 'set digest "sha256:280852156756ea3f39f9e774a30346f2e756244e1f432aea3061c4ac85d90a66"' 'remove tag' 'remove platforms' 'add platforms "linux/amd64" "linux/arm64/v8" "linux/arm/v7" "linux/s390x" "linux/ppc64le"' MODULE.bazel:distroless_base


  WARNING: Fetching from distroless/base@latest without an integrity hash. The result will not be cached.

  WARNING: /home/runner/work/monorepo/monorepo/BUILD.bazel:97:22: input 'package' to //:.aspect_rules_js/node_modules/fsevents@2.3.3/lc is a directory; dependency checking of directories is unsound

  WARNING: /home/runner/work/monorepo/monorepo/BUILD.bazel:97:22: input 'package' to //:.aspect_rules_js/node_modules/concat-map@0.0.1/lc is a directory; dependency checking of directories is unsound`.trim()
		)
	).resolves.toEqual(
		`
/home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/bazel_tools/tools/build_defs/repo/http.bzl:369:31: in <toplevel>

::error file=MODULE.bazel::  WARNING: Fetching from distroless/base@latest without an integrity hash. The result will not be cached.

  WARNING: For reproducible builds, a digest is recommended.
  Either set 'reproducible = False' to silence this warning, or run the following command to change oci.pull to use a digest:
  (make sure you use a recent buildozer release with MODULE.bazel support)

  buildozer 'set digest "sha256:280852156756ea3f39f9e774a30346f2e756244e1f432aea3061c4ac85d90a66"' 'remove tag' 'remove platforms' 'add platforms "linux/amd64" "linux/arm64/v8" "linux/arm/v7" "linux/s390x" "linux/ppc64le"' MODULE.bazel:distroless_base


::error file=MODULE.bazel::  WARNING: Fetching from distroless/base@latest without an integrity hash. The result will not be cached.

  WARNING: /home/runner/work/monorepo/monorepo/BUILD.bazel:97:22: input 'package' to //:.aspect_rules_js/node_modules/fsevents@2.3.3/lc is a directory; dependency checking of directories is unsound

  WARNING: /home/runner/work/monorepo/monorepo/BUILD.bazel:97:22: input 'package' to //:.aspect_rules_js/node_modules/concat-map@0.0.1/lc is a directory; dependency checking of directories is unsound`.trim()
	);
});

it('should rewrite a bazel DEBUG line', async () => {
	await expect(
		annotate(
			`DEBUG: /home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/aspect_rules_js/js/private/js_run_binary.bzl:311:14 something`
		)
	).resolves.toEqual(
		`::debug file=external/aspect_rules_js/js/private/js_run_binary.bzl,line=311,col=14::DEBUG: /home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/aspect_rules_js/js/private/js_run_binary.bzl:311:14 something`
	);
});

it('should rewrite an inline nested DEBUG WARNING line', async () => {
	await expect(
		annotate(
			`DEBUG: /home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/aspect_rules_ts/ts/private/ts_project.bzl:92:14: WARNING: disabling ts_project workers which are not currently supported with TS >= 5.0.0.`
		)
	).resolves.toEqual(
		'::warning file=external/aspect_rules_ts/ts/private/ts_project.bzl,line=92,col=14,title=disabling ts_project workers which are not currently supported with TS >= 5.0.0.::DEBUG: /home/runner/.cache/bazel/_bazel_runner/ee3b3f377828520170ae98f5c40d2da2/external/aspect_rules_ts/ts/private/ts_project.bzl:92:14: WARNING: disabling ts_project workers which are not currently supported with TS >= 5.0.0.'
	);
});

it('should be able to annotate a successful build', async () => {
	await expect(
		annotate(`
  INFO: Build completed, 1 test FAILED, 8634 total actions
  //:validate_renovate_config_test                                         PASSED in 5.1s
  //.github:validation                                                     PASSED in 0.5s
  //.github/workflows:validation                                           NO STATUS in 1.0s
  //bin/host/ffmpeg:smoke                                                  FAILED in 0.1s`)
	).resolves.toEqual(`
  INFO: Build completed, 1 test FAILED, 8634 total actions
  //:validate_renovate_config_test                                         PASSED in 5.1s
  //.github:validation                                                     PASSED in 0.5s
::warning title=//.github/workflows%3Avalidation failed to build in 1.0s,file=.github/workflows/BUILD.bazel::  //.github/workflows:validation                                           NO STATUS in 1.0s
::error title=//bin/host/ffmpeg%3Asmoke failed in 0.1s,file=bin/host/ffmpeg/BUILD.bazel::  //bin/host/ffmpeg:smoke                                                  FAILED in 0.1s`);
});

it('should be able to annotate bazel errors', async () => {
	await expect(
		annotate(
			`
ERROR: /home/runner/work/monorepo/monorepo/ts/pulumi/BUILD.bazel:10:11: Label '//ts/pulumi:shadwell.im/thomas/index.html' is invalid because 'ts/pulumi/shadwell.im' is a subpackage; perhaps you meant to put the colon here: '//ts/pulumi/shadwell.im:thomas/index.html'?
		`.trim()
		)
	).resolves.toEqual(
		`::error file=ts/pulumi/BUILD.bazel,line=10,col=11::ERROR: /home/runner/work/monorepo/monorepo/ts/pulumi/BUILD.bazel:10:11: Label '//ts/pulumi:shadwell.im/thomas/index.html' is invalid because 'ts/pulumi/shadwell.im' is a subpackage; perhaps you meant to put the colon here: '//ts/pulumi/shadwell.im:thomas/index.html'?`
	);
});

const later = <T>(): [(value: T | PromiseLike<T>) => void, Promise<T>] => {
	let okay: (value: T | PromiseLike<T>) => void;
	const p = new Promise<T>(ok => (okay = ok));

	return [okay!, p];
};

async function toArray<T>(i: AsyncIterable<T>): Promise<T[]> {
	const arr: T[] = [];
	for await (const v of i) arr.push(v);
	return arr;
}

const shimIterable = async function* <T>(
	v: Iterable<Promise<T>>
): AsyncGenerator<T> {
	for (const vv of v) {
		yield await vv;
	}
};

test('interleave', async () => {
	const [sendA, promiseA] = later<string>();
	const [sendB, promiseB] = later<string>();
	const [sendC, promiseC] = later<string>();
	const [sendD, promiseD] = later<string>();
	const [sendE, promiseE] = later<string>();
	const [sendF, promiseF] = later<string>();

	const r = bazel.interleave(
		shimIterable([promiseA, promiseB, promiseC]),
		shimIterable([promiseD, promiseE, promiseF])
	);

	setImmediate(() => sendA('H'));
	setImmediate(() => sendD('E'));
	setImmediate(() => sendB('L'));
	setImmediate(() => sendC('L'));
	setImmediate(() => sendE('O'));
	setImmediate(() => sendF('!'));

	await expect(toArray(r).then(v => v.join(''))).resolves.toEqual('HELLO!');
});
