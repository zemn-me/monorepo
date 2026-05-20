import { expect, test } from '@jest/globals';

import * as Bio from '#root/project/me/zemn/bio/index.js';
import { timelineRssFeed } from '#root/project/me/zemn/app/timeline/rss.xml/feed.js';
import * as lang from '#root/ts/react/lang/index.js';
import { RelativeURL } from '#root/ts/react/next/Link/relative_url.js';

const en = lang.tag('en-GB');

function event(overrides: Partial<Bio.Event>): Bio.Event {
	return {
		date: new Date(2024, 0, 1),
		id: 'event-id',
		title: en`Timeline event`,
		...overrides,
	};
}

test('builds an rss feed with all timeline entries', () => {
	const feed = timelineRssFeed([
		event({
			date: new Date(2024, 0, 1),
			id: 'past',
			title: en`Past event`,
		}),
		event({
			date: new Date(2026, 0, 1),
			id: 'upcoming',
			title: en`Upcoming event`,
		}),
	]);

	expect(feed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
	expect(feed).toContain('<rss version="2.0"');
	expect(feed).toContain('<title>zemn.me timeline</title>');
	expect(feed).toContain('<title>Upcoming event</title>');
	expect(feed).toContain('<title>Past event</title>');
	expect(feed).toContain('<pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>');
	expect(feed.indexOf('Upcoming event')).toBeLessThan(
		feed.indexOf('Past event')
	);
});

test('escapes xml text and resolves first-party links', () => {
	const feed = timelineRssFeed([
		event({
			description: en`Research & writing <notes>`,
			id: 'escaped',
			tags: [en`security & web`],
			title: en`A "quoted" event`,
			url: new RelativeURL('/article/2024/clean'),
		}),
	]);

	expect(feed).toContain('<title>A "quoted" event</title>');
	expect(feed).toContain(
		'<description>Research &amp; writing &lt;notes&gt;</description>'
	);
	expect(feed).toContain('<category>security &amp; web</category>');
	expect(feed).toContain('<link>https://zemn.me/article/2024/clean</link>');
	expect(feed).toContain(
		'<guid isPermaLink="false">https://zemn.me/#escaped</guid>'
	);
});
