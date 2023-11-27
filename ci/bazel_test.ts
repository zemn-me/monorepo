import * as bazel from 'ci/bazel';

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
