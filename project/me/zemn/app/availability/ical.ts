export interface CalendarEvent {
	readonly startsAt: Date;
	readonly endsAt: Date;
	readonly allDay: boolean;
}

interface RawCalendarEvent {
	readonly dtstart?: string;
	readonly dtend?: string;
}

const unfoldICal = (text: string) =>
	text.replaceAll(/\r?\n[ \t]/g, '').split(/\r?\n/);

function valuePart(line: string) {
	const colon = line.indexOf(':');
	return colon === -1 ? '' : line.slice(colon + 1);
}

function parseICalDate(value: string) {
	if (/^\d{8}$/.test(value)) {
		return {
			allDay: true,
			date: new Date(
				Date.UTC(
					Number(value.slice(0, 4)),
					Number(value.slice(4, 6)) - 1,
					Number(value.slice(6, 8))
				)
			),
		};
	}

	const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
	if (!match) return;

	return {
		allDay: false,
		date: new Date(
			Date.UTC(
				Number(match[1]),
				Number(match[2]) - 1,
				Number(match[3]),
				Number(match[4]),
				Number(match[5]),
				Number(match[6])
			)
		),
	};
}

function eventFromRaw(raw: RawCalendarEvent): CalendarEvent | undefined {
	if (!raw.dtstart || !raw.dtend) return;

	const start = parseICalDate(raw.dtstart);
	const end = parseICalDate(raw.dtend);
	if (!start || !end) return;

	return {
		allDay: start.allDay || end.allDay,
		startsAt: start.date,
		endsAt: end.date,
	};
}

export function parseICalEvents(text: string): readonly CalendarEvent[] {
	const events: CalendarEvent[] = [];
	let current: RawCalendarEvent | undefined;

	for (const line of unfoldICal(text)) {
		if (line === 'BEGIN:VEVENT') {
			current = {};
			continue;
		}

		if (line === 'END:VEVENT') {
			if (current) {
				const event = eventFromRaw(current);
				if (event) events.push(event);
			}
			current = undefined;
			continue;
		}

		if (!current) continue;

		if (line.startsWith('DTSTART')) {
			current = { ...current, dtstart: valuePart(line) };
		} else if (line.startsWith('DTEND')) {
			current = { ...current, dtend: valuePart(line) };
		}
	}

	return events;
}

export function busyEventsForRange(
	events: readonly CalendarEvent[],
	start: Date,
	end: Date
) {
	return events
		.filter(event => !event.allDay)
		.filter(
			event =>
				event.startsAt.getTime() < end.getTime() &&
				event.endsAt.getTime() > start.getTime()
		)
		.toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
