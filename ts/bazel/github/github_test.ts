import { expect, it } from '@jest/globals';

import { annotationsFromBuildEvents } from '#root/ts/bazel/github/index.js';

it('annotates failed test summaries', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			id: { testSummary: { label: '//foo:bar' } },
			payload: { testSummary: { overallStatus: 'FAILED' } },
		},
	]);

	expect(annotations).toEqual([
		'::error title=//foo%3Abar failed,file=foo/BUILD.bazel:://foo:bar FAILED',
	]);
	expect(failures).toEqual(['//foo:bar']);
	expect(errorObserved).toBe(true);
});

it('annotates flaky test summaries as warnings', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			id: { testSummary: { label: '//foo:flaky' } },
			payload: { testSummary: { overallStatus: 'FLAKY' } },
		},
	]);

	expect(annotations).toEqual([
		'::warning title=//foo%3Aflaky flaky,file=foo/BUILD.bazel:://foo:flaky FLAKY',
	]);
	expect(failures).toEqual([]);
	expect(errorObserved).toBe(false);
});

it('annotates aborted builds', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			payload: {
				aborted: { reason: 'INTERNAL', description: 'panic' },
			},
		},
	]);

	expect(annotations).toEqual([
		'::error title=Build aborted (INTERNAL)::panic',
	]);
	expect(failures).toEqual([]);
	expect(errorObserved).toBe(true);
});
