import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import {
	from,
	None,
	type Option,
	option_and_then,
	option_unwrap_or,
} from '#root/ts/option/types.js';
import { pipe } from '#root/ts/pipe.js';

export type Event = components['schemas']['AdminAnalyticsEvent'];
type Page = components['schemas']['AdminAnalyticsEventsResponse'];
export type Ranking = readonly (readonly [string, number])[];
export const dayMs = 86_400_000;
export const utcDate = (time: number) =>
	new Date(time).toISOString().slice(0, 10);
export const dateRange = (now: number, days: number) =>
	[utcDate(now - (days - 1) * dayMs), utcDate(now + dayMs)] as const;
export const eventTime = ({ event }: Event) => Date.parse(event.eventTime);
export const pagePath = ({ event }: Event) =>
	event.page?.urlPath || '(unknown page)';
export const site = ({ origin }: Event) => origin || '(unknown site)';
export const pageViews = (events: readonly Event[]) =>
	events.filter(({ event }) => event.eventName === 'page_view');
export const browserCount = (events: readonly Event[]) =>
	new Set(events.map(({ event }) => event.sessionId)).size;

export const uniqueEvents = (events: readonly Event[]): readonly Event[] =>
	Array.from(
		new Map(
			events.map(
				event =>
					[JSON.stringify([event.id, event.when]), event] as const
			)
		).values()
	).toSorted((a, b) => eventTime(b) - eventTime(a));

export const rank = (
	events: readonly Event[],
	key: (event: Event) => string
): Ranking =>
	Array.from(
		events
			.map(key)
			.reduce(
				(counts, label) =>
					counts.set(label, (counts.get(label) ?? 0) + 1),
				new Map<string, number>()
			)
	).toSorted(([a, x], [b, y]) => y - x || a.localeCompare(b));

export const source = ({ event }: Event): string =>
	pipe(
		from(event.page?.utmSource || undefined),
		value => option_and_then(value, value => `Campaign: ${value}`),
		value => option_unwrap_or(value, referrer(event.page?.referrer))
	);

function referrer(value: string | undefined): string {
	if (!value) return 'Direct / unknown';
	try {
		return new URL(value).hostname || 'Unknown referrer';
	} catch {
		return 'Unknown referrer';
	}
}

export const filterEvents = (
	events: readonly Event[],
	start: string,
	end: string,
	origin: string,
	search: string,
	path: Option<string> = None
) =>
	events.filter(
		event =>
			eventTime(event) >= Date.parse(start) &&
			eventTime(event) < Date.parse(end) &&
			(!origin || site(event) === origin) &&
			option_unwrap_or(
				option_and_then(path, path => pagePath(event) === path),
				true
			) &&
			`${pagePath(event)} ${event.event.eventName}`
				.toLowerCase()
				.includes(search.trim().toLowerCase())
	);

export const dailyViews = (
	events: readonly Event[],
	start: string,
	days: number
): Ranking =>
	pipe(
		new Map(rank(pageViews(events), event => utcDate(eventTime(event)))),
		counts =>
			Array.from({ length: days }, (_, index) =>
				pipe(
					utcDate(Date.parse(start) + index * dayMs),
					date => [date, counts.get(date) ?? 0] as const
				)
			)
	);

/** Stop large reports explicitly; a truncated feed must never look complete. */
export async function collectReport(
	fetchPage: (cursor?: string) => Promise<Page>,
	cursor?: string,
	remaining = 100
): Promise<readonly [readonly Event[], boolean]> {
	const page = await fetchPage(cursor);
	return page.nextCursor && remaining > 1
		? collectReport(fetchPage, page.nextCursor, remaining - 1).then(
				([events, complete]) =>
					[[...page.events, ...events], complete] as const
			)
		: [page.events, !page.nextCursor];
}
