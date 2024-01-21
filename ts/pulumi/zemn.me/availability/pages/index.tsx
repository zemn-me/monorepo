/**
 * @fileoverview page to show my availability (for meetings etc)
 */

import Head from 'next/head';
import { filter, flatten, map } from 'ts/iter';

interface QueryParamsObject {
	[key: string]: string[] | undefined;
}

type GCalQueryBoolean = '0' | '1';

type GCalTab = 'week' | 'month' | 'agenda';

interface CalendarConfigProps extends QueryParamsObject {
	/**
	 * A set of calendar sources to put on the calendar.
	 */
	src?: string[];

	mode?: [GCalTab];

	showCalendars?: [GCalQueryBoolean] | undefined;

	title?: [string];

	showTabs?: [GCalQueryBoolean];
}

const hasDefinedKey = (
	kv: [string, string[] | undefined]
): kv is [string, string[]] => typeof kv[1] !== 'undefined';

// For ?src=1&src=1, URLSearchParams expects
// [ [ "src", "1" ], [ "src", "1" ] ]
// rather than
// [ [ "src", "1" "1" ] ]
const unrollKeys = (
	v: Iterable<[string, string[]]>
): Iterable<[string, string]> =>
	flatten(map(v, ([k, v]) => map(v, v => [k, v])));

const gCalEmbedURL = (props: CalendarConfigProps) =>
	`https://calendar.google.com/calendar/u/0/embed?${new URLSearchParams([
		...unrollKeys(filter(Object.entries(props), hasDefinedKey)),
	]).toString()}`;

const URL = gCalEmbedURL({
	src: [
		'thomas@shadwell.im',
		'thomas@metatheory.gg',
		'thomas.shadwell@gmail.com',
		'thomas@openai.com',
	],
	mode: ['week'],
	showCalendars: ['0'],
});

export default function HomePage() {
	return (
		<>
			<Head>
				<meta
					content="object-src https://calendar.google.com"
					httpEquiv="Content-Security-Policy"
				/>
				<title>Thomas’ Availability</title>
			</Head>
			<main>
				<p>
					Occasionally, the below frame can have trouble loading due
					to Google security checks. If that happens, please{' '}
					<a href={URL}>view on Google calendar</a> directly instead.
				</p>
				<p>
					"All day" events are usually reminders, not times I am busy.
					Google Calendar does not let you filter for busy / free
					time.
				</p>
				<iframe src={URL} />
			</main>
		</>
	);
}
