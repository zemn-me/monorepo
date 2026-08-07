'use client';

import {
	faMicrophone,
	faStop,
	faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useRef, useState } from 'react';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import {
	useGetJournal,
	useGetMeScopes,
	usePostJournalEntry,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

type Journal = components['schemas']['Journal'];
type JournalEntry = components['schemas']['JournalEntry'];
type JournalSummary = components['schemas']['JournalSummary'];

const journalScope = 'journal';

function blobBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Could not encode the voice note.'));
				return;
			}
			resolve(result.slice(result.indexOf(',') + 1));
		};
		reader.readAsDataURL(blob);
	});
}

function errorMessage(value: unknown): string {
	return value instanceof Error
		? value.message
		: 'Could not save the voice note.';
}

function periodLabel(summary: JournalSummary): string {
	const start = new Date(summary.start);
	const options: Intl.DateTimeFormatOptions =
		summary.period === 'year'
			? { year: 'numeric' }
			: summary.period === 'month'
				? { month: 'long', year: 'numeric' }
				: { dateStyle: 'medium' };
	return new Intl.DateTimeFormat(undefined, options).format(start);
}

function citationID(entryID: string, segmentID: string) {
	return `transcript-${entryID}-${segmentID}`;
}

function SummaryCard({
	summary,
}: {
	readonly summary: JournalSummary;
}) {
	return (
		<article className={style.summary}>
			<header>
				<p>{periodLabel(summary)}</p>
				<h3>{summary.title}</h3>
			</header>
			<p>{summary.body}</p>
			<ul className={style.themes}>
				{summary.themes.map(theme => (
					<li key={theme}>{theme}</li>
				))}
			</ul>
			{summary.citations.length > 0 && (
				<nav aria-label={`Transcript citations for ${summary.title}`}>
					{summary.citations.map((citation, index) => (
						<a
							href={`#${citationID(citation.entryId, citation.segmentId)}`}
							key={`${citation.entryId}-${citation.segmentId}`}
						>
							[{index + 1}]
						</a>
					))}
				</nav>
			)}
		</article>
	);
}

function Transcript({ entry }: { readonly entry: JournalEntry }) {
	return (
		<ol className={style.transcript}>
			{entry.transcript.map(segment => (
				<li
					id={citationID(entry.id, segment.id)}
					key={segment.id}
				>
					<time>{segment.startSeconds.toFixed(1)}s</time>
					<span>{segment.text}</span>
				</li>
			))}
		</ol>
	);
}

function EntryCard({ entry }: { readonly entry: JournalEntry }) {
	return (
		<details className={style.entry}>
			<summary>
				<time dateTime={entry.recordedAt}>
					{new Intl.DateTimeFormat(undefined, {
						dateStyle: 'medium',
						timeStyle: 'short',
					}).format(new Date(entry.recordedAt))}
				</time>
				<span>{entry.summary.title}</span>
			</summary>
			<SummaryCard summary={entry.summary} />
			<h4>Linked transcript</h4>
			<Transcript entry={entry} />
		</details>
	);
}

function sameMonth(first: Date, second: Date) {
	return (
		first.getFullYear() === second.getFullYear() &&
		first.getMonth() === second.getMonth()
	);
}

function JournalTree({ journal }: { readonly journal: Journal }) {
	const years = journal.summaries
		.filter(summary => summary.period === 'year')
		.sort((a, b) => b.start.localeCompare(a.start));

	if (journal.entries.length === 0) {
		return (
			<p className={style.empty}>
				Your first voice note will begin the timeline.
			</p>
		);
	}

	return (
		<div className={style.tree}>
			{years.map(year => {
				const yearStart = new Date(year.start);
				const months = journal.summaries
					.filter(
						summary =>
							summary.period === 'month' &&
							new Date(summary.start).getFullYear() ===
								yearStart.getFullYear()
					)
					.sort((a, b) => b.start.localeCompare(a.start));
				return (
					<details open key={year.id}>
						<summary>{yearStart.getFullYear()}</summary>
						<SummaryCard summary={year} />
						<div className={style.branch}>
							{months.map(month => {
								const monthStart = new Date(month.start);
								const weeks = journal.summaries.filter(
									summary =>
										summary.period === 'week' &&
										sameMonth(
											new Date(summary.start),
											monthStart
										)
								);
								const days = journal.summaries
									.filter(
										summary =>
											summary.period === 'day' &&
											sameMonth(
												new Date(summary.start),
												monthStart
											)
									)
									.sort((a, b) =>
										b.start.localeCompare(a.start)
									);
								return (
									<details open key={month.id}>
										<summary>{periodLabel(month)}</summary>
										<SummaryCard summary={month} />
										<div className={style.branch}>
											{weeks.map(week => (
												<SummaryCard
													key={week.id}
													summary={week}
												/>
											))}
											{days.map(day => (
												<details key={day.id}>
													<summary>
														{periodLabel(day)}
													</summary>
													<SummaryCard summary={day} />
													{journal.entries
														.filter(entry => {
															const at = new Date(
																entry.recordedAt
															);
															const start =
																new Date(
																	day.start
																);
															const end =
																new Date(day.end);
															return (
																at >= start &&
																at < end
															);
														})
														.map(entry => (
															<EntryCard
																entry={entry}
																key={entry.id}
															/>
														))}
												</details>
											))}
										</div>
									</details>
								);
							})}
						</div>
					</details>
				);
			})}
		</div>
	);
}

export default function JournalPageClient() {
	const [idToken, , promptForLoginFuture] = useZemnMeAuth();
	const scopes = useGetMeScopes(idToken);
	const journal = useGetJournal(idToken);
	const createEntry = usePostJournalEntry(idToken);
	const recorder = useRef<MediaRecorder>();
	const chunks = useRef<Blob[]>([]);
	const startedAt = useRef(0);
	const [recording, setRecording] = useState(false);
	const [recordingError, setRecordingError] = useState<string>();
	const hasScope = scopes(
		values => values.includes(journalScope),
		() => false,
		() => false
	);
	const isLoggedIn = idToken(
		() => true,
		() => false,
		() => false
	);
	const promptForLogin = promptForLoginFuture(
		value => value,
		() => undefined,
		() => undefined
	);
	const status = useMemo(() => {
		if (createEntry.isPending) {
			return 'Transcribing and refreshing your summaries…';
		}
		if (createEntry.isSuccess) return 'Voice note saved.';
		if (createEntry.isError) return errorMessage(createEntry.error);
		return undefined;
	}, [createEntry.error, createEntry.isError, createEntry.isPending, createEntry.isSuccess]);

	const startRecording = async () => {
		setRecordingError(undefined);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			const mediaRecorder = new MediaRecorder(stream);
			recorder.current = mediaRecorder;
			chunks.current = [];
			startedAt.current = Date.now();
			mediaRecorder.ondataavailable = event => {
				if (event.data.size > 0) chunks.current.push(event.data);
			};
			mediaRecorder.onstop = () => {
				const durationSeconds =
					(Date.now() - startedAt.current) / 1000;
				const blob = new Blob(chunks.current, {
					type: mediaRecorder.mimeType,
				});
				stream.getTracks().forEach(track => track.stop());
				void blobBase64(blob)
					.then(audioBase64 =>
						createEntry.mutateAsync({
							audioBase64,
							contentType: mediaRecorder.mimeType.split(';')[0] as
								| 'audio/mp4'
								| 'audio/mpeg'
								| 'audio/ogg'
								| 'audio/wav'
								| 'audio/webm',
							durationSeconds,
							recordedAt: new Date().toISOString(),
							timeZone:
								Intl.DateTimeFormat().resolvedOptions()
									.timeZone,
						})
					)
					.catch(error => setRecordingError(errorMessage(error)));
			};
			mediaRecorder.start();
			setRecording(true);
		} catch (error) {
			setRecordingError(errorMessage(error));
		}
	};

	const stopRecording = () => {
		recorder.current?.stop();
		setRecording(false);
	};

	return (
		<main className={style.page}>
			<header className={style.hero}>
				<p className={style.eyebrow}>Private voice journal</p>
				<h1>Listen for the shape of your days.</h1>
				<p>
					Record a thought. Whisper links a timed transcript; GPT‑5.6
					surfaces themes across days, weeks, months, and years.
				</p>
			</header>
			{!isLoggedIn ? (
				<button
					disabled={promptForLogin === undefined}
					onClick={() => void promptForLogin?.()}
					type="button"
				>
					Sign in to open your journal
				</button>
			) : !hasScope ? (
				<p className={style.notice}>
					<FontAwesomeIcon icon={faTriangleExclamation} />
					Your account needs the <code>journal</code> scope.
				</p>
			) : (
				<>
					<section className={style.recorder}>
						<button
							disabled={createEntry.isPending}
							onClick={
								recording ? stopRecording : startRecording
							}
							type="button"
						>
							<FontAwesomeIcon
								icon={recording ? faStop : faMicrophone}
							/>
							{recording ? 'Finish note' : 'Record a note'}
						</button>
						{recording && <span>Recording…</span>}
						{(status ?? recordingError) && (
							<p>{recordingError ?? status}</p>
						)}
					</section>
					{journal(
						value => <JournalTree journal={value} />,
						() => <p>Loading your journal…</p>,
						error => (
							<p className={style.notice}>
								{errorMessage(error)}
							</p>
						)
					)}
				</>
			)}
		</main>
	);
}
