import { expect, test } from '@jest/globals';

import { Bio } from '#root/project/me/zemn/bio/bio.js';
import priorities from '#root/project/me/zemn/bio/priority.json';

test('whether we need to bazel run //project/me/zemn/bio:priority_sort', () => {
	const allIds = new Set(Bio.timeline.map(item => item.id));
	const prioritySet = new Set<string>(priorities);

	// intersection(allIds, prioritySet)
	const intersection = new Set(
		[...allIds].filter(id => prioritySet.has(id)),
	);

	expect(intersection).toEqual(allIds);
});
