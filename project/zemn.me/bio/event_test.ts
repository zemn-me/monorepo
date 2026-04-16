import { expect, test } from '@jest/globals';

import { Bio, eventHasStarted } from '#root/project/zemn.me/bio/bio.js';

test('events do not start before their date', () => {
	const event = Bio.timeline.find(
		item => item.id === '431c28bb-a3ef-48a3-9c66-5e42fc4d954c'
	);

	expect(event).toBeDefined();
	expect(eventHasStarted(event!, new Date(2026, 3, 29, 23, 59))).toBe(false);
	expect(eventHasStarted(event!, new Date(2026, 3, 30))).toBe(true);
});
