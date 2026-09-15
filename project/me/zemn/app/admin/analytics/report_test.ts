import { expect, it } from '@jest/globals';

import { Some } from '#root/ts/option/types.js';

import {
	browserCount,
	collectReport,
	dailyViews,
	dateRange,
	type Event,
	filterEvents,
	pageViews,
	rank,
	source,
	uniqueEvents,
} from './report.js';

const event = (
	id: string,
	time: string,
	name = 'page_view',
	session = 'browser-1'
): Event => ({
	id: session,
	when: `${time}#${id}`,
	receivedAt: time,
	origin: 'https://zemn.me',
	event: {
		eventId: id,
		eventTime: time,
		eventName: name,
		sessionId: session,
		page: { urlPath: '/' },
	},
});

it('uses UTC dates across month boundaries and daylight-saving changes', () => {
	expect(dateRange(Date.parse('2026-03-09T00:30:00Z'), 7)).toEqual([
		'2026-03-03',
		'2026-03-10',
	]);
	expect(dateRange(Date.parse('2026-01-01T23:59:00Z'), 1)).toEqual([
		'2026-01-01',
		'2026-01-02',
	]);
});

it('counts page views separately from custom events, deduplicates pages, and fills quiet days', () => {
	const events = uniqueEvents([
		event('a', '2026-03-01T00:00:00Z'),
		event('a', '2026-03-01T00:00:00Z'),
		event('b', '2026-03-01T12:00:00Z'),
		event('c', '2026-03-03T12:00:00Z', 'click'),
		event('d', '2026-03-03T13:00:00Z', 'page_view', 'browser-2'),
	]);
	expect(events).toHaveLength(4);
	expect(pageViews(events)).toHaveLength(3);
	expect(browserCount(pageViews(events))).toBe(2);
	expect(dailyViews(events, '2026-03-01', 3)).toEqual([
		['2026-03-01', 2],
		['2026-03-02', 0],
		['2026-03-03', 1],
	]);
});

it('filters dates, site and case-insensitive search together, excluding the end date', () => {
	const events = [
		event('a', '2026-03-01T00:00:00Z'),
		event('b', '2026-03-02T00:00:00Z'),
		{
			...event('c', '2026-03-01T12:00:00Z'),
			origin: 'https://another.example',
		},
	];
	expect(
		filterEvents(
			events,
			'2026-03-01',
			'2026-03-02',
			'https://zemn.me',
			' PAGE_VIEW '
		)
	).toEqual([events[0]]);
	expect(
		filterEvents(events, '2026-03-01', '2026-03-02', '', 'no match')
	).toEqual([]);
});

it('ranks ties predictably without treating missing or malformed sources as external traffic', () => {
	const withPage = (page: Event['event']['page']): Event => ({
		...event('a', '2026-03-01T00:00:00Z'),
		event: { ...event('a', '2026-03-01T00:00:00Z').event, page },
	});
	expect(
		source(
			withPage({
				utmSource: 'newsletter',
				referrer: 'https://example.org/path',
			})
		)
	).toBe('Campaign: newsletter');
	expect(
		source(withPage({ referrer: 'https://example.org/path?secret=value' }))
	).toBe('example.org');
	expect(source(withPage({ referrer: 'invalid' }))).toBe('Unknown referrer');
	expect(source(withPage(undefined))).toBe('Direct / unknown');
	expect(
		rank(
			[withPage({ utmSource: 'z' }), withPage({ utmSource: 'a' })],
			source
		)
	).toEqual([
		['Campaign: a', 1],
		['Campaign: z', 1],
	]);
});

it('follows cursors including empty pages, reports truncation, and propagates page failures', async () => {
	const first = event('a', '2026-03-01T00:00:00Z');
	const fetch = async (cursor?: string) =>
		cursor ? { events: [first] } : { events: [], nextCursor: 'next' };
	await expect(collectReport(fetch)).resolves.toEqual([[first], true]);
	await expect(collectReport(fetch, undefined, 1)).resolves.toEqual([
		[],
		false,
	]);
	await expect(
		collectReport(async cursor => {
			if (cursor) throw new Error('unavailable');
			return { events: [first], nextCursor: 'next' };
		})
	).rejects.toThrow('unavailable');
});

it('drills into an exact page without matching its descendants', () => {
	const root = event('a', '2026-03-01T00:00:00Z');
	const child = {
		...event('b', '2026-03-01T12:00:00Z'),
		event: { ...root.event, page: { urlPath: '/journal' } },
	};
	expect(
		filterEvents(
			[root, child],
			'2026-03-01',
			'2026-03-02',
			'',
			'',
			Some('/')
		)
	).toEqual([root]);
});
