import { expect, test } from '@jest/globals';

import { durationInMs } from '#root/go/gazelle/ts/example/duration/duration.js';

test('duration Millisecond equals 1', () => {
	expect(durationInMs()).toBe(1);
});
