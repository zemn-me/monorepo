'use client';

import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useWebHaptics } from 'web-haptics/react';

import style from '#root/project/me/zemn/app/key/style.module.css';
import { PosterDisplayName } from '#root/project/me/zemn/components/InlineLogin/inline_login.js';
import { ProgressCircle } from '#root/project/me/zemn/components/ProgressCircle/ProgressCircle.js';
import {
	type CallboxEvent,
	useGetCallboxEventsForToken,
	useGetMeKeyStatus,
	useGetMeScopes,
	usePostMeKey,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import { Date as LocalizedDate } from '#root/ts/react/lang/date.js';

const requiredScope = 'callbox_key';
const logsScope = 'callbox_key_logs_read';
const keyEventPageSize = 32;

function progressRatio(min: number, max: number, now: number) {
	const range = max - min;
	const norm = now - min;
	return norm / range;
}

function parseOpenUntil(
	openUntil: string | undefined
): Temporal.ZonedDateTime | undefined {
	if (!openUntil) return undefined;

	try {
		return Temporal.ZonedDateTime.from(openUntil);
	} catch {
		try {
			const instant = Temporal.Instant.from(openUntil);
			return instant.toZonedDateTimeISO(
				Temporal.Now.zonedDateTimeISO().timeZoneId
			);
		} catch {
			return undefined;
		}
	}
}

interface OpenTimerProps {
	readonly start: Temporal.ZonedDateTime;
	readonly end: Temporal.ZonedDateTime;
}

function OpenTimer({ start, end }: OpenTimerProps) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		let frame = 0;
		const update = () => {
			setNow(Date.now());
			frame = requestAnimationFrame(update);
		};
		frame = requestAnimationFrame(update);
		return () => cancelAnimationFrame(frame);
	}, []);

	const done = now >= end.epochMilliseconds;
	const progress = progressRatio(
		start.epochMilliseconds,
		end.epochMilliseconds,
		now
	);
	const clampedProgress = Math.min(1, Math.max(0, progress));

	return (
		<ProgressCircle
			className={style.timerIndicator}
			loss
			progress={done ? 1 : clampedProgress}
		/>
	);
}

function eventEmoji(event: CallboxEvent) {
	return event.open ? '🔓' : '🔒';
}

function eventZonedDateTime(event: CallboxEvent) {
	return Temporal.Instant.from(event.when).toZonedDateTimeISO(
		Temporal.Now.zonedDateTimeISO().timeZoneId
	);
}

interface KeyEventFeedProps {
	readonly idToken?: string;
}

function KeyEventFeed({ idToken }: KeyEventFeedProps) {
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const query = useGetCallboxEventsForToken(idToken, keyEventPageSize);
	const events = query.data?.pages.flatMap(page => page.events) ?? [];

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (
					entry?.isIntersecting &&
					query.hasNextPage &&
					!query.isFetchingNextPage
				) {
					void query.fetchNextPage();
				}
			},
			{ rootMargin: '75% 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

	if (query.isError && events.length === 0) {
		return <p className={style.eventEmpty}>Could not load key history.</p>;
	}

	if (query.isPending && events.length === 0) {
		return <p className={style.eventEmpty}>Loading key history…</p>;
	}

	if (events.length === 0) {
		return <p className={style.eventEmpty}>No key history yet.</p>;
	}

	return (
		<section className={style.eventFeed} aria-label="Key history">
			<ol className={style.eventList}>
				{events.map(event => (
					<li className={style.eventRow} key={event.id}>
						<span className={style.eventIcon} aria-hidden="true">
							{eventEmoji(event)}
						</span>
						<span className={style.eventText}>
							<span className={style.eventActor}>
								<PosterDisplayName
									fallback={event.actor}
									poster={{
										email_address: event.actorEmail,
										given_name: event.actorGivenName,
										family_name: event.actorFamilyName,
									}}
								/>
							</span>
							<span className={style.eventAction}>
								{event.action}
							</span>
						</span>
						<LocalizedDate
							className={style.eventTime}
							date={eventZonedDateTime(event)}
							time
						/>
					</li>
				))}
			</ol>
			<div className={style.eventSentinel} ref={sentinelRef}>
				{query.isFetchingNextPage ? 'Loading…' : null}
			</div>
		</section>
	);
}

export default function KeyPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const fut_scopes = useGetMeScopes(fut_idToken);
	const { trigger } = useWebHaptics();
	const postKey = usePostMeKey(
		fut_idToken,
		() => {
			void trigger('nudge');
		},
		() => {
			void trigger('success');
		},
		() => {
			void trigger('error');
		}
	);
	const doorStatus = useGetMeKeyStatus(fut_idToken);

	const noAuth = () => (
		<button
			aria-label="Authenticate with OIDC"
			disabled={fut_promptForLogin(
				() => false,
				() => true,
				() => true
			)}
			onClick={fut_promptForLogin(
				v => () => void v(),
				() => undefined,
				() => undefined
			)}
		>
			Login with OIDC
		</button>
	);

	return fut_idToken(
		() => (
			<section className={style.root}>
				<button
					aria-label={doorStatus(
						status => (status.open ? 'Lock Door' : 'Unlock Door'),
						() => 'Unlock Door',
						() => 'Unlock Door'
					)}
					className={classNames(
						style.lockButton,
						doorStatus(
							s => (s.open ? style.lockButtonOpen : undefined),
							() => undefined,
							() => undefined
						)
					)}
					disabled={fut_scopes(
						scopes =>
							!scopes.includes(requiredScope) ||
							postKey.isPending,
						() => true,
						() => false
					)}
					onClick={() => {
						void postKey.mutate(
							doorStatus(
								status => !status.open,
								() => true,
								() => true
							)
						);
					}}
					type="button"
				>
					<span>
						{doorStatus(
							status => (status.open ? '🔓' : '🔒'),
							(/*loading*/) => '⏳',
							(/*error*/) => '⚠️'
						)}
					</span>
				</button>
				{doorStatus(
					status => {
						if (!status.open) return null;
						const openUntil = parseOpenUntil(status.openUntil);
						const openedAt = parseOpenUntil(status.lastOpenedAt);
						if (openUntil === undefined || openedAt === undefined)
							return null;

						return (
							<div className={style.timerRow}>
								<OpenTimer end={openUntil} start={openedAt} />
							</div>
						);
					},
					() => null,
					() => null
				)}
				{doorStatus(
					status => {
						if (!status.open) {
							return <p className={style.status}>Locked.</p>;
						}

						return null;
					},
					() => (
						<p className={style.status}>Checking lock status…</p>
					),
					() => (
						<p className={style.status}>Lock status unavailable.</p>
					)
				)}
				{fut_scopes(
					scopes =>
						scopes.includes(logsScope) ? (
							<KeyEventFeed
								idToken={fut_idToken(
									token => token,
									() => undefined,
									() => undefined
								)}
							/>
						) : null,
					() => null,
					() => null
				)}
			</section>
		),
		noAuth,
		noAuth
	);
}
