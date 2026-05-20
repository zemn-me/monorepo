import { expect, test } from '@jest/globals';

import * as Bio from '#root/project/me/zemn/bio/index.js';
import { splitEventsByStart } from '#root/project/me/zemn/components/timeline/events.js';
import * as lang from '#root/ts/react/lang/index.js';

const en = lang.tag('en-GB');

function event(id: string, date: Date): Bio.Event {
	return {
		date,
		id,
		title: en`Test event`,
	};
}

test('splits future events from started events', () => {
	const now = new Date(2026, 4, 20);
	const split = splitEventsByStart(
		[
			event('tomorrow', new Date(2026, 4, 21)),
			event('yesterday', new Date(2026, 4, 19)),
			event('later', new Date(2026, 5, 1)),
			event('now', now),
		],
		now
	);

	expect(split.future.map(({ id }) => id)).toEqual(['tomorrow', 'later']);
	expect(split.started.map(({ id }) => id)).toEqual(['now', 'yesterday']);
});
