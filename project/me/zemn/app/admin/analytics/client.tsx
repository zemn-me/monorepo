'use client';

import { useState } from 'react';

import Link from '#root/project/me/zemn/components/Link/index.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import {
	from,
	is_some,
	None,
	type Option,
	option_and_then,
	option_unwrap_or,
	Some,
} from '#root/ts/option/types.js';
import { pipe } from '#root/ts/pipe.js';

import {
	browserCount,
	dailyViews,
	dateRange,
	type Event,
	filterEvents,
	pagePath,
	pageViews,
	type Ranking,
	rank,
	site,
	source,
} from './report.js';
import style from './style.module.css';
import { useReport } from './useReport.js';

const number = (value: number) => value.toLocaleString();

function Breakdown({
	title,
	rows,
	onSelect,
}: {
	readonly title: string;
	readonly rows: Ranking;
	readonly onSelect?: (value: string) => void;
}) {
	return (
		<section className={style.card} aria-label={title}>
			<h2>{title}</h2>
			<p className={style.muted}>Page views · top 10</p>
			{rows.length ? (
				<ol className={style.ranking}>
					{rows.slice(0, 10).map(([label, count]) => (
						<li key={label}>
							<div>
								{onSelect ? (
									<button
										type="button"
										onClick={() => onSelect(label)}
									>
										{label}
									</button>
								) : (
									<span>{label}</span>
								)}
								<strong>{number(count)}</strong>
							</div>
							<meter
								min={0}
								max={rows[0]?.[1] ?? 1}
								value={count}
								aria-label={`${label}: ${number(count)} page views`}
							/>
						</li>
					))}
				</ol>
			) : (
				<p>No page views in this selection.</p>
			)}
		</section>
	);
}

function EventDetails({ event }: { readonly event: Event }) {
	return (
		<details className={style.event}>
			<summary>
				<time dateTime={event.event.eventTime}>
					{new Date(event.event.eventTime).toLocaleString()}
				</time>{' '}
				<strong>{event.event.eventName}</strong>{' '}
				<span>{pagePath(event)}</span>
			</summary>
			<pre>{JSON.stringify(event, null, 2)}</pre>
		</details>
	);
}

function Dashboard({
	events,
	complete,
	start,
	end,
	days,
}: {
	readonly events: readonly Event[];
	readonly complete: boolean;
	readonly start: string;
	readonly end: string;
	readonly days: number;
}) {
	const [origin, setOrigin] = useState('');
	const [search, setSearch] = useState('');
	const [path, setPath] = useState<Option<string>>(() => None);
	const [visible, setVisible] = useState(25);
	return (
		<>
			<p role="status" className={complete ? style.muted : style.warning}>
				{complete
					? `Complete range · ${number(events.length)} events loaded`
					: `Partial report · newest ${number(events.length)} events only. Choose a shorter period for complete totals.`}
			</p>
			<div className={style.filters}>
				<label>
					Site
					<select
						value={origin}
						onChange={event => setOrigin(event.target.value)}
					>
						<option value="">All sites</option>
						{rank(events, site).map(([value]) => (
							<option key={value} value={value}>
								{value}
							</option>
						))}
					</select>
				</label>
				<label>
					Search pages or events
					<input
						type="search"
						value={search}
						placeholder="e.g. /journal or page_view"
						onChange={event => setSearch(event.target.value)}
					/>
				</label>
				{option_unwrap_or(
					option_and_then(path, path => (
						<span>
							Page: <code>{path}</code>
						</span>
					)),
					null
				)}
				{origin || search || is_some(path) ? (
					<button
						type="button"
						onClick={() => {
							setOrigin('');
							setSearch('');
							setPath(() => None);
						}}
					>
						Clear filters
					</button>
				) : null}
			</div>
			{pipe(
				filterEvents(events, start, end, origin, search, path),
				selected => (
					<>
						<dl className={style.metrics}>
							{(
								[
									['Page views', pageViews(selected).length],
									[
										'Browsers',
										browserCount(pageViews(selected)),
									],
									[
										'Pages viewed',
										new Set(
											pageViews(selected).map(pagePath)
										).size,
									],
									['All events', selected.length],
								] as const
							).map(([label, count]) => (
								<div className={style.card} key={label}>
									<dt>{label}</dt>
									<dd>
										<output aria-label={label}>
											{number(count)}
										</output>
									</dd>
								</div>
							))}
						</dl>
						<p className={style.muted}>
							Browsers are distinct stored browser IDs with page
							views, not people or visits. Counts include
							automated traffic. All panels follow the filters
							above.
						</p>
						{selected.length === 0 ? (
							<p role="status">No events match this selection.</p>
						) : null}
						<section
							className={style.card}
							aria-label="Traffic over time"
						>
							<h2>Traffic over time</h2>
							<p className={style.muted}>
								Daily page views · UTC · today is still in
								progress{!complete ? ' · partial data' : ''}
							</p>
							{pipe(dailyViews(selected, start, days), values => (
								<div
									className={style.chart}
									role="list"
									aria-label="Daily page views"
								>
									{values.map(([date, count]) => (
										<div
											key={date}
											role="listitem"
											aria-label={`${date}: ${count} page views`}
											title={`${date}: ${number(count)} page views`}
										>
											<span>{number(count)}</span>
											<div className={style.barTrack}>
												<div
													className={style.bar}
													style={{
														height: `${(100 * count) / Math.max(1, ...values.map(([, count]) => count))}%`,
													}}
												/>
											</div>
											<time dateTime={date}>
												{date.slice(5)}
											</time>
										</div>
									))}
								</div>
							))}
						</section>
						<div className={style.breakdowns}>
							<Breakdown
								title="Top pages"
								rows={rank(pageViews(selected), pagePath)}
								onSelect={path => setPath(() => Some(path))}
							/>
							<Breakdown
								title="Traffic sources"
								rows={rank(pageViews(selected), source)}
							/>
							<Breakdown
								title="Languages"
								rows={rank(
									pageViews(selected),
									({ event }) =>
										event.context?.locale || 'Unknown'
								)}
							/>
							<Breakdown
								title="Viewport sizes"
								rows={rank(pageViews(selected), ({ event }) =>
									pipe(
										from(event.context?.viewport),
										value =>
											option_and_then(
												value,
												({ width }) =>
													width < 768
														? 'Small (<768px)'
														: width < 1200
															? 'Medium (768–1199px)'
															: 'Large (1200px+)'
											),
										value =>
											option_unwrap_or(value, 'Unknown')
									)
								)}
							/>
						</div>
						<p className={style.muted}>
							Sources use UTM source when available, otherwise the
							referrer hostname. Referrers can include internal
							navigation; direct and unavailable referrers are
							grouped together.
						</p>
						<section
							className={style.card}
							aria-label="Recent events"
						>
							<h2>Recent events</h2>
							<p className={style.muted}>
								Newest first · times in your local timezone ·
								expand for the stored payload
							</p>
							{selected.slice(0, visible).map(event => (
								<EventDetails
									key={JSON.stringify([event.id, event.when])}
									event={event}
								/>
							))}
							{selected.length > visible ? (
								<button
									type="button"
									onClick={() =>
										setVisible(value => value + 25)
									}
								>
									Show 25 more events
								</button>
							) : null}
						</section>
					</>
				)
			)}
		</>
	);
}

function Report({
	token,
	days,
	revision,
}: {
	readonly token: string;
	readonly days: number;
	readonly revision: number;
}) {
	const [start, end] = dateRange(revision, days);
	return useReport(
		token,
		start,
		end,
		revision
	)(
		([events, complete]) => (
			<Dashboard
				complete={complete}
				days={days}
				end={end}
				events={events}
				start={start}
			/>
		),
		() => <p role="status">Loading analytics for the selected period…</p>,
		error => <p role="alert">{error.message} Use Refresh to try again.</p>
	);
}

function Analytics({ token }: { readonly token: string }) {
	const [days, setDays] = useState(7);
	const [revision, setRevision] = useState(Date.now);
	return (
		<section>
			<header className={style.pageHeader}>
				<div>
					<Link href="/admin">Admin</Link>
					<h1>Analytics</h1>
					<p>
						Understand what brings people here and what they read.
					</p>
				</div>
				<div className={style.filters}>
					<label>
						Period
						<select
							value={days}
							onChange={event =>
								setDays(Number(event.target.value))
							}
						>
							<option value={1}>Today</option>
							<option value={7}>Last 7 days</option>
							<option value={30}>Last 30 days</option>
						</select>
					</label>
					<button
						type="button"
						onClick={() => setRevision(Date.now())}
					>
						Refresh
					</button>
				</div>
			</header>
			<p className={style.muted}>
				{dateRange(revision, days)[0]} through{' '}
				{new Date(revision).toISOString().slice(0, 10)} · UTC dates ·
				requested {new Date(revision).toLocaleTimeString()}
			</p>
			<Report
				days={days}
				key={`${days}/${revision}`}
				revision={revision}
				token={token}
			/>
		</section>
	);
}

export default function AdminAnalyticsPageClient() {
	const [token, , login] = useZemnMeAuth();
	const authenticate = () =>
		login(
			prompt => (
				<button
					aria-label="Authenticate with OIDC"
					onClick={() => void prompt()}
				>
					Login with OIDC
				</button>
			),
			() => <p role="status">Preparing login…</p>,
			() => (
				<p role="alert">
					Could not prepare login. Reload the page to try again.
				</p>
			)
		);
	return (
		<div className={style.page}>
			{token(
				token => (
					<Analytics token={token} />
				),
				authenticate,
				authenticate
			)}
		</div>
	);
}
