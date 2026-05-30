'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { useGetAdminAnalyticsEvents } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import { future_to_option } from '#root/ts/future/option/future_to_option.js';
import {
	is_some as option_is_some,
	unwrap as option_unwrap,
	unwrap_or as option_unwrap_or,
} from '#root/ts/option/types.js';

import style from './style.module.css';

type AdminAnalyticsEvent = components['schemas']['AdminAnalyticsEvent'];

function formatEventTime(value: string | undefined) {
	if (value === undefined) {
		return '';
	}

	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) {
		return value;
	}

	return date.toLocaleString();
}

function eventSummary(event: AdminAnalyticsEvent) {
	const pagePath = event.event.page?.urlPath;
	if (pagePath !== undefined && pagePath !== '') {
		return `${event.event.eventName} on ${pagePath}`;
	}

	return event.event.eventName;
}

function EventCard({ event }: { readonly event: AdminAnalyticsEvent }) {
	const payload = useMemo(() => JSON.stringify(event, null, 2), [event]);

	return (
		<article className={style.eventCard}>
			<header className={style.eventHeader}>
				<div>
					<h2>{eventSummary(event)}</h2>
					<p>{formatEventTime(event.event.eventTime)}</p>
				</div>
				<code>{event.event.eventId}</code>
			</header>
			<dl className={style.metaGrid}>
				<div>
					<dt>Session</dt>
					<dd>
						<code>{event.id}</code>
					</dd>
				</div>
				<div>
					<dt>Stored</dt>
					<dd>{formatEventTime(event.receivedAt)}</dd>
				</div>
				<div>
					<dt>Origin</dt>
					<dd>{event.origin ?? ''}</dd>
				</div>
				<div>
					<dt>Source IP</dt>
					<dd>{event.sourceIp ?? ''}</dd>
				</div>
				<div>
					<dt>Sort key</dt>
					<dd>
						<code>{event.when}</code>
					</dd>
				</div>
			</dl>
			<details>
				<summary>Payload</summary>
				<pre className={style.payload}>{payload}</pre>
			</details>
		</article>
	);
}

function AnalyticsEvents({ id_token }: { readonly id_token: string }) {
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const [loadedCursors, setLoadedCursors] = useState<ReadonlySet<string>>(
		() => new Set()
	);
	const [events, setEvents] = useState<readonly AdminAnalyticsEvent[]>([]);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const cursorKey = cursor ?? '';
	const eventsQuery = useGetAdminAnalyticsEvents(id_token, cursor);
	const nextCursor = eventsQuery.data?.nextCursor;

	useEffect(() => {
		if (eventsQuery.data === undefined || loadedCursors.has(cursorKey)) {
			return;
		}

		setEvents(current => [...current, ...eventsQuery.data.events]);
		setLoadedCursors(current => new Set(current).add(cursorKey));
	}, [cursorKey, eventsQuery.data, loadedCursors]);

	useEffect(() => {
		const target = bottomRef.current;
		if (target === null) {
			return;
		}

		const observer = new IntersectionObserver(entries => {
			if (
				entries.some(entry => entry.isIntersecting) &&
				nextCursor !== undefined &&
				!eventsQuery.isFetching
			) {
				setCursor(nextCursor);
			}
		});
		observer.observe(target);
		return () => observer.disconnect();
	}, [eventsQuery.isFetching, nextCursor]);

	return (
		<section className={style.page}>
			<header className={style.pageHeader}>
				<div>
					<p>
						<Link href="/admin">Admin</Link>
					</p>
					<h1>Analytics Events</h1>
				</div>
				<p>{events.length} loaded</p>
			</header>
			{events.map(event => (
				<EventCard event={event} key={`${event.id}/${event.when}`} />
			))}
			{eventsQuery.status === 'error' ? (
				<p role="alert">Could not load analytics events.</p>
			) : null}
			<div className={style.loadMore} ref={bottomRef}>
				{nextCursor !== undefined ? (
					<button
						disabled={eventsQuery.isFetching}
						onClick={() => setCursor(nextCursor)}
						type="button"
					>
						{eventsQuery.isFetching ? 'Loading' : 'Load more'}
					</button>
				) : eventsQuery.isFetching ? (
					<p>Loading</p>
				) : (
					<p>End of events</p>
				)}
			</div>
		</section>
	);
}

export default function AdminAnalyticsPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const idToken = future_to_option(fut_idToken);
	const promptForLogin = future_to_option(fut_promptForLogin);
	const loginReady = option_is_some(promptForLogin);

	if (!option_is_some(idToken)) {
		return (
			<button
				aria-label="Authenticate with OIDC"
				disabled={!loginReady}
				onClick={() => {
					if (!loginReady) return;
					void option_unwrap(promptForLogin)();
				}}
			>
				Login with OIDC
			</button>
		);
	}

	return <AnalyticsEvents id_token={option_unwrap_or(idToken, '')} />;
}
