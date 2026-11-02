import * as Bio from '#root/project/me/zemn/bio/index.js';

export interface SplitTimelineEvents {
	readonly future: readonly Bio.Event[];
	readonly started: readonly Bio.Event[];
}

export function compareEventsNewestFirst(a: Bio.Event, b: Bio.Event): number {
	return +b.date - +a.date;
}

export function compareEventsSoonestFirst(a: Bio.Event, b: Bio.Event): number {
	return +a.date - +b.date;
}

export function splitEventsByStart(
	events: Iterable<Bio.Event>,
	now: Date = new Date()
): SplitTimelineEvents {
	const future: Bio.Event[] = [];
	const started: Bio.Event[] = [];

	for (const event of events) {
		if (Bio.eventHasStarted(event, now)) {
			started.push(event);
			continue;
		}

		future.push(event);
	}

	return {
		future: future.sort(compareEventsSoonestFirst),
		started: started.sort(compareEventsNewestFirst),
	};
}
