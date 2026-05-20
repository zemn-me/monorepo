import { createRequire } from 'node:module';

import * as Bio from '#root/project/me/zemn/bio/index.js';
import { RelativeURL } from '#root/ts/react/next/Link/relative_url.js';

export const SITE_URL = new URL('https://zemn.me/');
export const TIMELINE_RSS_URL = new URL('/timeline/rss.xml', SITE_URL);

const ATOM_XMLNS = 'http://www.w3.org/2005/Atom';

interface XmlBuilder {
	att(name: string, value: string): XmlBuilder;
	ele(name: string, value?: string): XmlBuilder;
	ele(
		name: string,
		attributes: Readonly<Record<string, string>>,
		value?: string
	): XmlBuilder;
	end(options?: { readonly pretty?: boolean }): string;
}

const require = createRequire(import.meta.url);
const { create } = require('xmlbuilder') as {
	readonly create: (
		name: string,
		options?: { readonly encoding?: string }
	) => XmlBuilder;
};

function textElement(parent: XmlBuilder, name: string, text: string): void {
	parent.ele(name, text);
}

function eventTimelineURL(event: Bio.Event): URL {
	const url = new URL(SITE_URL);
	url.hash = event.id;
	return url;
}

function absoluteURL(url: URL | RelativeURL): URL {
	if (url instanceof URL) return url;

	return new URL(url.value, SITE_URL);
}

function eventLink(event: Bio.Event): URL {
	return event.url ? absoluteURL(event.url) : eventTimelineURL(event);
}

function eventDescription(event: Bio.Event): string {
	const parts = [event.description?.text, event.address].filter(
		(v): v is string => v !== undefined
	);

	return parts.join('\n\n');
}

function rssDate(date: Date): string {
	return new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
	).toUTCString();
}

function itemForEvent(channel: XmlBuilder, event: Bio.Event): void {
	const timelineURL = eventTimelineURL(event).toString();
	const description = eventDescription(event);
	const item = channel.ele('item');

	textElement(item, 'title', event.title.text);
	textElement(item, 'link', eventLink(event).toString());
	item.ele('guid', { isPermaLink: 'false' }, timelineURL);
	textElement(item, 'pubDate', rssDate(event.date));
	if (description) textElement(item, 'description', description);
	for (const category of event.tags ?? []) {
		textElement(item, 'category', category.text);
	}
}

function sortedEvents(events: readonly Bio.Event[]): readonly Bio.Event[] {
	return [...events].sort((a, b) => +b.date - +a.date);
}

export function timelineRssFeed(
	events: readonly Bio.Event[] = Bio.Bio.timeline
): string {
	const rss = create('rss', { encoding: 'UTF-8' })
		.att('version', '2.0')
		.att('xmlns:atom', ATOM_XMLNS);
	const channel = rss.ele('channel');
	textElement(channel, 'title', 'zemn.me timeline');
	textElement(channel, 'link', SITE_URL.toString());
	textElement(channel, 'description', 'Events from the zemn.me timeline.');
	textElement(channel, 'language', 'en-GB');
	channel.ele('atom:link', {
		href: TIMELINE_RSS_URL.toString(),
		rel: 'self',
		type: 'application/rss+xml',
	});
	for (const event of sortedEvents(events)) itemForEvent(channel, event);

	return rss.end({ pretty: false });
}
