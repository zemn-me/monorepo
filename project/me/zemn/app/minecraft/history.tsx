import { useState } from 'react';

import { historyRows } from '#root/project/me/zemn/app/minecraft/history_data.js';
import style from '#root/project/me/zemn/app/minecraft/style.module.css';
import type {
	MinecraftHistoryEvent,
	useMinecraftHistory,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';

const labels = {
	login: 'Logged in',
	logout: 'Logged out',
	server_on: 'Server on',
	server_off: 'Server off',
} as const;

function timestamp(value: string) {
	return new Date(value).toLocaleString(undefined, { timeZoneName: 'short' });
}

function EventTime({ event }: { readonly event?: MinecraftHistoryEvent }) {
	return event ? (
		<time dateTime={event.timestamp}>{timestamp(event.timestamp)}</time>
	) : (
		<>Not recorded</>
	);
}

export function MinecraftHistoryChart({
	history,
}: {
	readonly history: ReturnType<typeof useMinecraftHistory>;
}) {
	const [range, setRange] = useState('all');
	const [selected, setSelected] = useState<MinecraftHistoryEvent>();
	const end = Date.parse(history.before);
	const first = history.events[0];
	const start =
		range === 'all'
			? Math.min(
					first ? Date.parse(first.timestamp) : end - 86400000,
					end - 60000
				)
			: end - Number(range) * 86400000;
	const position = (time: number) =>
		Math.max(0, Math.min(100, ((time - start) / (end - start)) * 100));
	const rows = historyRows(history.events);

	return (
		<section
			className={style.eventPanel}
			aria-label="Minecraft activity history"
		>
			<div className={style.historyHeader}>
				<h2>Activity history</h2>
				<label>
					Time range{' '}
					<select
						value={range}
						onChange={event => setRange(event.currentTarget.value)}
					>
						<option value="all">All time</option>
						<option value="7">Last 7 days</option>
						<option value="1">Last 24 hours</option>
					</select>
				</label>
				<button
					type="button"
					disabled={history.loading}
					onClick={() => {
						setSelected(undefined);
						history.refresh();
					}}
				>
					Refresh history
				</button>
			</div>
			<p className={style.historyNote}>
				All recorded history. Logs that expired before history retention
				was enabled are unavailable. Times are local.
			</p>
			{history.loading && (
				<p role="status">
					Loading all history… {history.events.length} events found.
				</p>
			)}
			{history.error && (
				<p role="alert">
					Could not load the complete history. Refresh to try again.
				</p>
			)}
			{!history.loading && !history.error && !first && (
				<p>No activity has been recorded yet.</p>
			)}
			{first && (
				<>
					<p className={style.historyNote}>
						Green: logged in / server on. Gray: logged out / server
						off. Select a dot for its exact time. Bars connect
						recorded events; blank areas are unknown.
					</p>
					<div className={style.historyScroll}>
						<div className={style.timeline}>
							{rows.map(row => (
								<div className={style.historyRow} key={row.id}>
									<strong>{row.name}</strong>
									<div
										className={style.historyTrack}
										role="group"
										aria-label={`${row.name} activity`}
									>
										{row.events.map(event => {
											const at = Date.parse(
												event.timestamp
											);
											const on =
												event.kind === 'login' ||
												event.kind === 'server_on';
											const until =
												row.ends.get(event.id) ??
												Infinity;
											const description = `${row.name}: ${labels[event.kind]}, ${timestamp(event.timestamp)}`;
											return (
												<span key={event.id}>
													{Number.isFinite(until) &&
														until >= start &&
														at <= end && (
															<span
																aria-hidden="true"
																className={
																	on
																		? style.historyOn
																		: style.historyOff
																}
																style={{
																	left: `${position(at)}%`,
																	width: `${position(until) - position(at)}%`,
																}}
															/>
														)}
													{at >= start &&
														at <= end && (
															<button
																type="button"
																className={
																	on
																		? style.historyLogin
																		: style.historyLogout
																}
																style={{
																	left: `${position(at)}%`,
																}}
																title={
																	description
																}
																aria-label={
																	description
																}
																onClick={() =>
																	setSelected(
																		event
																	)
																}
															/>
														)}
												</span>
											);
										})}
									</div>
								</div>
							))}
							<div className={style.historyAxis}>
								<span>
									{timestamp(new Date(start).toISOString())}
								</span>
								<span>{timestamp(history.before)}</span>
							</div>
						</div>
					</div>
					<p aria-live="polite">
						{selected
							? `${selected.player ?? 'Server'}: ${labels[selected.kind]} · ${timestamp(selected.timestamp)}`
							: 'Select an event to inspect it.'}
					</p>
					<div className={style.historyScroll}>
						<table className={style.historyTable}>
							<caption>
								Latest recorded activity (all time)
							</caption>
							<thead>
								<tr>
									<th scope="col">Player / server</th>
									<th scope="col">Last login / on</th>
									<th scope="col">Last logout / off</th>
								</tr>
							</thead>
							<tbody>
								{rows.map(row => (
									<tr key={row.id}>
										<th scope="row">{row.name}</th>
										<td>
											<EventTime
												event={row.events.findLast(
													event =>
														event.kind ===
															'login' ||
														event.kind ===
															'server_on'
												)}
											/>
										</td>
										<td>
											<EventTime
												event={row.events.findLast(
													event =>
														event.kind ===
															'logout' ||
														event.kind ===
															'server_off'
												)}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<details>
						<summary>
							All recorded events ({history.events.length})
						</summary>
						<ol className={style.eventList}>
							{history.events.map(event => (
								<li key={event.id}>
									<span>
										{event.player ?? 'Server'}:{' '}
										{labels[event.kind]}
									</span>
									<EventTime event={event} />
								</li>
							))}
						</ol>
					</details>
				</>
			)}
		</section>
	);
}
