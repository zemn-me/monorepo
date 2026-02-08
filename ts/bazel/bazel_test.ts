import { Readable } from 'node:stream';

import { expect, test } from '@jest/globals';

import {
	parseBuildEventJsonLines,
	withBuildEventJsonFile,
} from '#root/ts/bazel/bazel.js';

test('withBuildEventJsonFile replaces existing flag', () => {
	const args = withBuildEventJsonFile([
		'build',
		'//:example',
		'--build_event_json_file=/tmp/bep.jsonl',
	]);

	expect(args).toContain('--build_event_json_file=PIPE');
	expect(args).not.toContain('--build_event_json_file=/tmp/bep.jsonl');
});

test('parseBuildEventJsonLines yields parsed events', async () => {
	const stream = Readable.from([
		'{"id":{"buildFinished":{}}}\n',
		'\n',
		'{"payload":{"aborted":{"reason":"USER"}}}\n',
	]);

	const events = [];
	for await (const event of parseBuildEventJsonLines(stream)) {
		events.push(event);
	}

	expect(events).toHaveLength(2);
	expect(events[0]?.id).toBeDefined();
});
