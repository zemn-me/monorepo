'use client';

import {
	faCheck,
	faChevronDown,
	faMicrophone,
	faStop,
	faTriangleExclamation,
	faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { parseAsFloat, parseAsString, useQueryStates } from 'nuqs';
import {
	ChangeEvent,
	memo,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Temporal } from 'temporal-polyfill';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import { FootnotePreviews } from '#root/project/me/zemn/components/FootnotePreviews/footnote_previews.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import {
	useDeleteJournalEntry,
	useGetJournal,
	useGetMeScopes,
	usePostJournalEntry,
	useRefreshJournal,
	useUpdateJournalEntryDate,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import {
	Date as LocalizedDate,
	Time as LocalizedTime,
	MonthYear,
} from '#root/ts/react/lang/date.js';

type Journal = components['schemas']['Journal'];
type JournalCitation = components['schemas']['JournalCitation'];
type JournalEntry = components['schemas']['JournalEntry'];
type JournalTranscriptSegment = JournalEntry['transcript'][number];
type JournalSummary = components['schemas']['JournalSummary'];
type JournalSummaryBlock = components['schemas']['JournalSummaryBlock'];
type JournalContentType =
	components['schemas']['JournalEntryCreate']['contentType'];

export type JournalRoute = 'year' | 'month' | 'week' | 'day';

const journalReadScope = 'journal_read';
const journalWriteScope = 'journal_write';
const maxJournalAudioBytes = 25 * 1024 * 1024;
const transcriptParagraphPauseMs = 3_000;
const uploadErrorLifetimeMs = 8_000;
const isDevelopment = process.env.NODE_ENV === 'development';

function errorMessage(value: unknown): string {
	return value instanceof Error
		? value.message
		: 'Could not save the voice note.';
}

function PeriodDate({
	summary,
	timeZone,
}: {
	readonly summary: Pick<JournalSummary, 'period' | 'start'>;
	readonly timeZone?: string;
}) {
	if (summary.period === 'journal') return <>Journal overview</>;
	if (!timeZone) {
		const start = new Date(summary.start);
		if (summary.period === 'year') {
			return (
				<time dateTime={summary.start}>{start.getUTCFullYear()}</time>
			);
		}
		if (summary.period === 'month') return <MonthYear date={start} />;
		if (summary.period === 'week') {
			return (
				<>
					Week starting <LocalizedDate date={start} />
				</>
			);
		}
		return <LocalizedDate date={start} />;
	}
	const start = Temporal.Instant.from(summary.start).toZonedDateTimeISO(
		timeZone
	);
	if (summary.period === 'year') {
		return <time dateTime={start.toString()}>{start.year}</time>;
	}
	if (summary.period === 'month') return <MonthYear date={start} />;
	if (summary.period === 'week') {
		return (
			<>
				Week starting <LocalizedDate date={start} />
			</>
		);
	}
	return <LocalizedDate date={start} />;
}

function journalEntryDate(entry: JournalEntry): Temporal.ZonedDateTime {
	return Temporal.Instant.from(entry.recordedAt).toZonedDateTimeISO(
		entry.timeZone
	);
}

function citationID(entryID: string, segmentID: string) {
	return `transcript-${entryID}-${segmentID}`;
}

const journalPlaybackQuery = {
	entry: parseAsString,
	t: parseAsFloat,
};

function roundedMediaTime(time: number): number {
	return Math.max(0, Math.round(time * 10) / 10);
}

function journalPlaybackHref(
	entryID: string,
	time: number,
	basePath = ''
): string {
	const separator = basePath.includes('?') ? '&' : '?';
	return `${basePath}${separator}${new URLSearchParams({
		entry: entryID,
		t: String(roundedMediaTime(time)),
	})}`;
}

function mediaTimestamp(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
		2,
		'0'
	)}:${String(seconds).padStart(2, '0')}`;
}

function followsLinkNormally(event: ReactMouseEvent<HTMLAnchorElement>) {
	return (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	);
}

interface JournalPlayback {
	readonly activeEntryID: string | undefined;
	readonly hrefForSegment: (entryID: string, segmentID: string) => string;
	readonly labelForSegment: (entryID: string, segmentID: string) => string;
	readonly playSegment: (entryID: string, segmentID: string) => boolean;
	readonly playingEntryID: string | undefined;
	readonly playingSegmentID: string | undefined;
	readonly progressed: (entryID: string, time: number) => void;
	readonly quoteForSegment: (entryID: string, segmentID: string) => string;
	readonly removeEntry: (entryID: string) => void;
	readonly registerAudio: (
		entryID: string,
		audio: HTMLAudioElement | null
	) => void;
	readonly started: (entryID: string) => void;
	readonly stopped: (entryID: string, time: number) => void;
	readonly titleForEntry: (entryID: string) => string;
}

function useJournalPlayback(
	journal: Journal,
	citationDestination?: (entryID: string) => string | undefined,
	navigationKey = ''
): JournalPlayback {
	const audioElements = useRef(new Map<string, HTMLAudioElement>());
	const appliedNavigation = useRef<string>();
	const pendingSeekTimes = useRef(new Map<string, number>());
	const entriesRef = useRef(journal.entries);
	entriesRef.current = journal.entries;
	const [cursor, setCursor] = useQueryStates(journalPlaybackQuery, {
		history: 'replace',
		shallow: true,
		throttleMs: 250,
	});
	const cursorRef = useRef(cursor);
	const [playing, setPlaying] = useState<{
		readonly entryID: string;
		readonly segmentID: string | undefined;
	}>();
	const playingRef = useRef(playing);
	playingRef.current = playing;
	const registerAudio = useCallback(
		(entryID: string, audio: HTMLAudioElement | null) => {
			if (audio) audioElements.current.set(entryID, audio);
			else {
				audioElements.current.delete(entryID);
				pendingSeekTimes.current.delete(entryID);
			}
		},
		[]
	);
	const pauseOthers = useCallback((entryID: string) => {
		for (const [otherEntryID, audio] of audioElements.current) {
			if (otherEntryID !== entryID && !audio.paused) audio.pause();
		}
	}, []);
	const seekAndPlay = useCallback((entryID: string, time: number) => {
		const audio = audioElements.current.get(entryID);
		if (!audio) return false;
		const target = Math.max(0, time);
		pendingSeekTimes.current.set(entryID, target);
		const seek = () => {
			if (audioElements.current.get(entryID) !== audio) return;
			const pending = pendingSeekTimes.current.get(entryID);
			if (pending === undefined) return;
			pendingSeekTimes.current.delete(entryID);
			if (Math.abs(audio.currentTime - pending) >= 0.25) {
				audio.currentTime = pending;
			}
		};
		if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
			audio.addEventListener('loadedmetadata', seek, { once: true });
		} else {
			seek();
		}
		void audio.play().catch(() => undefined);
		return true;
	}, []);
	const updateCursor = useCallback(
		(entryID: string, time: number, history: 'push' | 'replace') => {
			const next = { entry: entryID, t: roundedMediaTime(time) };
			const previous = cursorRef.current;
			if (previous.entry === next.entry && previous.t === next.t) return;
			cursorRef.current = next;
			void setCursor(next, {
				history,
				throttleMs: history === 'push' ? 50 : 250,
			});
		},
		[setCursor]
	);
	const segmentAt = useCallback((entryID: string, time: number) => {
		const milliseconds = time * 1000;
		return entriesRef.current
			.find(entry => entry.id === entryID)
			?.transcript.find(
				segment =>
					milliseconds >= segment.startMs &&
					milliseconds < segment.endMs
			);
	}, []);
	const setPlayingSegment = useCallback(
		(entryID: string, time: number) => {
			const segmentID = segmentAt(entryID, time)?.id;
			const current = playingRef.current;
			if (
				current?.entryID === entryID &&
				current.segmentID === segmentID
			) {
				return false;
			}
			const next = { entryID, segmentID };
			playingRef.current = next;
			setPlaying(next);
			return true;
		},
		[segmentAt]
	);
	const started = useCallback(
		(entryID: string) => {
			pauseOthers(entryID);
			const audio = audioElements.current.get(entryID);
			if (!audio) return;
			setPlayingSegment(entryID, audio.currentTime);
			if (cursorRef.current.entry !== entryID) {
				updateCursor(entryID, audio.currentTime, 'push');
			}
		},
		[pauseOthers, setPlayingSegment, updateCursor]
	);
	const progressed = useCallback(
		(entryID: string, time: number) => {
			const audio = audioElements.current.get(entryID);
			if (!audio || audio.paused) return;
			if (!setPlayingSegment(entryID, time)) return;
			if (cursorRef.current.entry !== entryID) return;
			const segment = segmentAt(entryID, time);
			updateCursor(
				entryID,
				(segment?.startMs ?? time * 1000) / 1000,
				'replace'
			);
		},
		[segmentAt, setPlayingSegment, updateCursor]
	);
	const stopped = useCallback(
		(entryID: string, time: number) => {
			if (cursorRef.current.entry === entryID) {
				updateCursor(entryID, time, 'replace');
			}
			if (playingRef.current?.entryID !== entryID) return;
			playingRef.current = undefined;
			setPlaying(undefined);
		},
		[updateCursor]
	);
	const segmentFor = useCallback(
		(entryID: string, segmentID: string) =>
			journal.entries
				.find(value => value.id === entryID)
				?.transcript.find(value => value.id === segmentID),
		[journal.entries]
	);
	const hrefForSegment = useCallback(
		(entryID: string, segmentID: string) => {
			const segment = segmentFor(entryID, segmentID);
			return journalPlaybackHref(
				entryID,
				(segment?.startMs ?? 0) / 1000,
				citationDestination?.(entryID)
			);
		},
		[citationDestination, segmentFor]
	);
	const labelForSegment = useCallback(
		(entryID: string, segmentID: string) =>
			mediaTimestamp(segmentFor(entryID, segmentID)?.startMs ?? 0),
		[segmentFor]
	);
	const quoteForSegment = useCallback(
		(entryID: string, segmentID: string) =>
			segmentFor(entryID, segmentID)?.text ?? '',
		[segmentFor]
	);
	const titleForEntry = useCallback(
		(entryID: string) =>
			journal.entries.find(value => value.id === entryID)?.summary
				?.title ?? '',
		[journal.entries]
	);
	const playSegment = useCallback(
		(entryID: string, segmentID: string) => {
			const segment = segmentFor(entryID, segmentID);
			const target = document.getElementById(
				citationID(entryID, segmentID)
			);
			let parent = target?.parentElement;
			while (parent) {
				if (parent instanceof HTMLDetailsElement) parent.open = true;
				parent = parent.parentElement;
			}
			target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			const audio = audioElements.current.get(entryID);
			if (!audio || !segment) return false;
			updateCursor(entryID, segment.startMs / 1000, 'push');
			pauseOthers(entryID);
			return seekAndPlay(entryID, segment.startMs / 1000);
		},
		[pauseOthers, seekAndPlay, segmentFor, updateCursor]
	);
	const removeEntry = useCallback(
		(entryID: string) => {
			const audio = audioElements.current.get(entryID);
			audio?.pause();
			pendingSeekTimes.current.delete(entryID);
			if (playingRef.current?.entryID === entryID) {
				playingRef.current = undefined;
				setPlaying(undefined);
			}
			if (cursorRef.current.entry !== entryID) return;
			const next = { entry: null, t: null };
			cursorRef.current = next;
			void setCursor(next, { history: 'replace' });
		},
		[setCursor]
	);
	const applyURLCursor = useCallback(
		(force = false) => {
			const location = `${window.location.pathname}${window.location.search}`;
			if (!force && appliedNavigation.current === location) return;
			appliedNavigation.current = location;
			const parameters = new URLSearchParams(window.location.search);
			const entryID = parameters.get('entry');
			const timeValue = parameters.get('t');
			if (!entryID || timeValue === null) return;
			const time = Number(timeValue);
			if (!Number.isFinite(time)) return;
			cursorRef.current = { entry: entryID, t: time };
			const entry = entriesRef.current.find(
				value => value.id === entryID
			);
			if (!entry) return;
			pauseOthers(entryID);
			const targetMilliseconds = time * 1000;
			const segment = entry.transcript.findLast(
				value => value.startMs <= targetMilliseconds
			);
			const target = segment
				? document.getElementById(citationID(entry.id, segment.id))
				: document.getElementById(`entry-${entryID}`);
			let parent: HTMLElement | null = target;
			while (parent) {
				if (parent instanceof HTMLDetailsElement) parent.open = true;
				parent = parent.parentElement;
			}
			target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			seekAndPlay(entryID, time);
		},
		[pauseOthers, seekAndPlay]
	);
	useEffect(() => {
		applyURLCursor();
	}, [applyURLCursor, navigationKey]);
	useEffect(() => {
		const applyBrowserNavigation = () => applyURLCursor(true);
		window.addEventListener('popstate', applyBrowserNavigation);
		return () =>
			window.removeEventListener('popstate', applyBrowserNavigation);
	}, [applyURLCursor]);
	return useMemo(
		() => ({
			activeEntryID: cursor.entry ?? undefined,
			hrefForSegment,
			labelForSegment,
			playSegment,
			playingEntryID: playing?.entryID,
			playingSegmentID: playing?.segmentID,
			progressed,
			quoteForSegment,
			removeEntry,
			registerAudio,
			started,
			stopped,
			titleForEntry,
		}),
		[
			cursor.entry,
			hrefForSegment,
			labelForSegment,
			playSegment,
			playing?.entryID,
			playing?.segmentID,
			progressed,
			quoteForSegment,
			removeEntry,
			registerAudio,
			started,
			stopped,
			titleForEntry,
		]
	);
}

const citationReferencePattern = /\[\^([0-9]+)\]/g;

interface SummaryCitationLink {
	readonly citation: JournalCitation;
	readonly href: string;
	readonly label: string;
	readonly number: number;
	readonly quote: string;
	readonly referenceID: string;
	readonly title: string;
}

function SummaryBlock({
	block,
	citationIDs,
	links,
	playback,
}: {
	readonly block: JournalSummaryBlock;
	readonly citationIDs: readonly string[];
	readonly links: readonly SummaryCitationLink[];
	readonly playback: JournalPlayback;
}) {
	const { linksByHref, markdown } = useMemo(() => {
		const referenced = new Set<number>();
		const markdownHref = (index: number) =>
			`?journal-citation-ref=${index + 1}`;
		let renderedMarkdown = block.markdown.replace(
			citationReferencePattern,
			(reference, value: string) => {
				const index = Number(value) - 1;
				const link = links[index];
				if (!link) return reference;
				referenced.add(index);
				return `[${link.number}](${markdownHref(index)})`;
			}
		);
		const missingIndexes = links
			.map((_, index) => index)
			.filter(index => !referenced.has(index));
		if (missingIndexes.length > 0) {
			renderedMarkdown += ` ${missingIndexes
				.map(
					index => `[${links[index]?.number}](${markdownHref(index)})`
				)
				.join('')}`;
		}
		return {
			linksByHref: new Map(
				links.map((link, index) => [
					markdownHref(index),
					{
						citationID: citationIDs[index],
						link,
					},
				])
			),
			markdown: renderedMarkdown,
		};
	}, [block.markdown, citationIDs, links]);
	const markdownComponents = useMemo<Components>(
		() => ({
			a: ({ children, href }) => {
				const resolved = href ? linksByHref.get(href) : undefined;
				if (!resolved) return <a href={href}>{children}</a>;
				const { citationID, link } = resolved;
				const { citation } = link;
				return (
					<sup className={style.citation}>
						<a
							aria-label={`Play source at ${link.label}`}
							data-citation-entry-id={citation.entryId}
							data-citation-segment-id={citation.segmentId}
							data-footnote-ref=""
							data-footnote-target={link.referenceID}
							href={link.href}
							id={citationID}
							onClick={event => {
								if (followsLinkNormally(event)) return;
								if (
									playback.playSegment(
										citation.entryId,
										citation.segmentId
									)
								) {
									event.preventDefault();
								}
							}}
						>
							[{children}]
						</a>
					</sup>
				);
			},
		}),
		[linksByHref, playback.playSegment]
	);

	return (
		<div data-journal-summary-block>
			<ReactMarkdown components={markdownComponents}>
				{markdown}
			</ReactMarkdown>
		</div>
	);
}

function journalCitationKey(citation: JournalCitation) {
	return `${citation.entryId}\u0000${citation.segmentId}`;
}

function SummaryCardView({
	playback,
	showPeriod = true,
	showTitle = true,
	summary,
	timeZone,
}: {
	readonly playback: JournalPlayback;
	readonly showPeriod?: boolean;
	readonly showTitle?: boolean;
	readonly summary: JournalSummary;
	readonly timeZone?: string;
}) {
	const [article, setArticle] = useState<HTMLElement | null>(null);
	const { blockCitationIDs, blockLinks, links } = useMemo(() => {
		const linksByCitation = new Map<string, SummaryCitationLink>();
		const prefix = `journal-footnote-${summary.id}`;
		const blockCitationIDs: string[][] = [];
		const blockLinks = summary.blocks.map((block, blockIndex) =>
			block.citations.map((citation, citationIndex) => {
				const key = journalCitationKey(citation);
				const citationID = `${prefix}-ref-${blockIndex + 1}-${citationIndex + 1}`;
				(blockCitationIDs[blockIndex] ??= []).push(citationID);
				const existing = linksByCitation.get(key);
				if (existing) return existing;
				const link: SummaryCitationLink = {
					citation,
					href: playback.hrefForSegment(
						citation.entryId,
						citation.segmentId
					),
					label: playback.labelForSegment(
						citation.entryId,
						citation.segmentId
					),
					number: linksByCitation.size + 1,
					quote:
						citation.quote ||
						playback.quoteForSegment(
							citation.entryId,
							citation.segmentId
						),
					referenceID: `${prefix}-${linksByCitation.size + 1}`,
					title: playback.titleForEntry(citation.entryId),
				};
				linksByCitation.set(key, link);
				return link;
			})
		);
		return {
			blockCitationIDs,
			blockLinks,
			links: [...linksByCitation.values()],
		};
	}, [
		playback.hrefForSegment,
		playback.labelForSegment,
		playback.quoteForSegment,
		playback.titleForEntry,
		summary.blocks,
		summary.id,
	]);
	return (
		<article
			className={`${style.summary} ${!showTitle && !showPeriod ? style.summaryEmbedded : ''}`}
			ref={setArticle}
		>
			{(showPeriod || showTitle) && (
				<header>
					{showPeriod && (
						<p>
							<PeriodDate
								summary={summary}
								timeZone={timeZone}
							/>
						</p>
					)}
					{showTitle && <h3>{summary.title}</h3>}
				</header>
			)}
			{summary.blocks.map((block, blockIndex) => (
				<SummaryBlock
					block={block}
					citationIDs={blockCitationIDs[blockIndex] ?? []}
					key={blockIndex}
					links={blockLinks[blockIndex] ?? []}
					playback={playback}
				/>
			))}
			{links.map(link => (
				<span
					data-journal-citation-source={link.number}
					hidden
					id={link.referenceID}
					key={journalCitationKey(link.citation)}
				>
					{link.title && (
						<>
							<cite>{link.title}</cite>.{' '}
						</>
					)}
					“{link.quote}” <a href={link.href}>{link.label}</a>
				</span>
			))}
			<FootnotePreviews root={article} />
		</article>
	);
}

const SummaryCard = memo(
	SummaryCardView,
	(previous, next) =>
		previous.summary === next.summary &&
		previous.playback.hrefForSegment === next.playback.hrefForSegment &&
		previous.playback.labelForSegment === next.playback.labelForSegment &&
		previous.playback.playSegment === next.playback.playSegment &&
		previous.playback.quoteForSegment === next.playback.quoteForSegment &&
		previous.playback.titleForEntry === next.playback.titleForEntry &&
		previous.showPeriod === next.showPeriod &&
		previous.showTitle === next.showTitle &&
		previous.timeZone === next.timeZone
);

function transcriptParagraphs(
	segments: readonly JournalTranscriptSegment[]
): JournalTranscriptSegment[][] {
	const paragraphs: JournalTranscriptSegment[][] = [];
	for (const segment of segments) {
		const previous = paragraphs.at(-1)?.at(-1);
		if (
			!previous ||
			segment.startMs - previous.endMs > transcriptParagraphPauseMs
		) {
			paragraphs.push([]);
		}
		paragraphs.at(-1)?.push(segment);
	}
	return paragraphs;
}

function TranscriptView({
	entry,
	playback,
}: {
	readonly entry: JournalEntry;
	readonly playback: JournalPlayback;
}) {
	const currentlySpokenSegmentID =
		playback.playingEntryID === entry.id
			? playback.playingSegmentID
			: undefined;
	const paragraphs = transcriptParagraphs(entry.transcript);
	const scroller = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!currentlySpokenSegmentID) return;
		const container = scroller.current;
		const segment = document.getElementById(
			citationID(entry.id, currentlySpokenSegmentID)
		);
		if (!container || !segment || !container.contains(segment)) return;
		const containerBounds = container.getBoundingClientRect();
		const segmentBounds = segment.getBoundingClientRect();
		container.scrollTo({
			top:
				container.scrollTop +
				segmentBounds.top -
				containerBounds.top -
				container.clientHeight / 2 +
				segmentBounds.height / 2,
		});
	}, [currentlySpokenSegmentID, entry.id]);
	return (
		<div
			aria-label="Transcript"
			className={style.transcriptScroller}
			data-journal-transcript={entry.id}
			ref={scroller}
			role="region"
		>
			<div
				className={`${style.transcript} ${currentlySpokenSegmentID ? style.transcriptFollowing : ''}`}
				data-journal-transcript-text
			>
				{paragraphs.map((paragraph, paragraphIndex) => {
					const firstSegment = paragraph[0];
					const paragraphTimestamp = mediaTimestamp(
						firstSegment?.startMs ?? 0
					);
					return (
						<p
							className={style.transcriptParagraph}
							key={paragraphIndex}
						>
							{firstSegment && (
								<>
									<a
										aria-label={`Play paragraph at ${paragraphTimestamp}`}
										className={
											style.transcriptParagraphTimestamp
										}
										data-journal-transcript-paragraph=""
										href={playback.hrefForSegment(
											entry.id,
											firstSegment.id
										)}
										onClick={event => {
											if (followsLinkNormally(event))
												return;
											if (
												playback.playSegment(
													entry.id,
													firstSegment.id
												)
											) {
												event.preventDefault();
											}
										}}
									>
										<time
											dateTime={`PT${firstSegment.startMs / 1000}S`}
										>
											{paragraphTimestamp}
										</time>
									</a>{' '}
								</>
							)}
							{paragraph.map((segment, segmentIndex) => {
								const timestamp = mediaTimestamp(
									segment.startMs
								);
								const currentlySpoken =
									segment.id === currentlySpokenSegmentID;
								return (
									<span
										className={style.transcriptSegment}
										data-journal-currently-spoken={
											currentlySpoken || undefined
										}
										id={citationID(entry.id, segment.id)}
										key={segment.id}
									>
										{segmentIndex > 0 && ' '}
										<a
											aria-current={
												currentlySpoken
													? 'true'
													: undefined
											}
											aria-label={`Play at ${timestamp}: ${segment.text}`}
											data-journal-transcript-segment={
												segment.id
											}
											href={playback.hrefForSegment(
												entry.id,
												segment.id
											)}
											onClick={event => {
												if (followsLinkNormally(event))
													return;
												if (
													playback.playSegment(
														entry.id,
														segment.id
													)
												) {
													event.preventDefault();
												}
											}}
										>
											<span
												aria-hidden="true"
												className={
													style.transcriptTimestamp
												}
											>
												{timestamp}
											</span>
											{segment.text}
										</a>
									</span>
								);
							})}
						</p>
					);
				})}
			</div>
		</div>
	);
}

function spokenSegmentFor(
	entry: JournalEntry,
	playback: JournalPlayback
): string | undefined {
	return playback.playingEntryID === entry.id
		? playback.playingSegmentID
		: undefined;
}

const Transcript = memo(
	TranscriptView,
	(previous, next) =>
		previous.entry === next.entry &&
		previous.playback.hrefForSegment === next.playback.hrefForSegment &&
		previous.playback.playSegment === next.playback.playSegment &&
		spokenSegmentFor(previous.entry, previous.playback) ===
			spokenSegmentFor(next.entry, next.playback)
);

const deleteThreshold = 90;

function SwipeToDelete({
	entryID,
	onDelete,
	onDeleting,
}: {
	readonly entryID: string;
	readonly onDelete: (entryID: string) => Promise<void>;
	readonly onDeleting: (entryID: string) => void;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const draggingPointer = useRef<number>();
	const progressRef = useRef(0);
	const [progress, setProgress] = useState(0);
	const [deleting, setDeleting] = useState(false);
	const [failure, setFailure] = useState<string>();
	const updateProgress = useCallback((next: number) => {
		const clamped = Math.max(0, Math.min(100, next));
		progressRef.current = clamped;
		setProgress(clamped);
	}, []);
	const updateFromPointer = useCallback(
		(clientX: number) => {
			const bounds = trackRef.current?.getBoundingClientRect();
			if (!bounds) return;
			const thumbWidth = Math.min(44, bounds.width);
			const travel = Math.max(1, bounds.width - thumbWidth);
			updateProgress(
				((clientX - bounds.left - thumbWidth / 2) / travel) * 100
			);
		},
		[updateProgress]
	);
	const deleteNow = useCallback(async () => {
		if (deleting) return;
		setDeleting(true);
		setFailure(undefined);
		onDeleting(entryID);
		try {
			await onDelete(entryID);
		} catch (error) {
			setFailure(
				error instanceof Error
					? error.message
					: 'Could not delete the journal entry.'
			);
			updateProgress(0);
			setDeleting(false);
		}
	}, [deleting, entryID, onDelete, onDeleting, updateProgress]);
	const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (draggingPointer.current !== event.pointerId) return;
		updateFromPointer(event.clientX);
		draggingPointer.current = undefined;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		if (progressRef.current >= deleteThreshold) void deleteNow();
		else updateProgress(0);
	};
	const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
		let next: number | undefined;
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				next = progressRef.current - 10;
				break;
			case 'ArrowRight':
			case 'ArrowUp':
				next = progressRef.current + 10;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = 100;
				break;
			case 'Enter':
			case ' ':
				if (progressRef.current >= deleteThreshold) {
					event.preventDefault();
					void deleteNow();
				}
				return;
			default:
				return;
		}
		event.preventDefault();
		updateProgress(next);
	};

	return (
		<div className={style.deleteControl}>
			<div
				className={style.deleteTrack}
				data-journal-delete-track={entryID}
				ref={trackRef}
			>
				<span aria-hidden="true" className={style.deleteLabel}>
					{deleting ? 'Deleting…' : 'Swipe to delete'}
				</span>
				<span
					aria-hidden="true"
					className={style.deleteProgress}
					style={{ inlineSize: `${progress}%` }}
				/>
				<button
					aria-label="Swipe to delete journal entry"
					aria-orientation="horizontal"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(progress)}
					aria-valuetext={
						progress >= deleteThreshold
							? 'Release to permanently delete'
							: 'Slide all the way right to permanently delete'
					}
					className={style.deleteThumb}
					data-journal-delete-thumb={entryID}
					disabled={deleting}
					onKeyDown={handleKeyDown}
					onPointerCancel={event => {
						if (draggingPointer.current !== event.pointerId) return;
						draggingPointer.current = undefined;
						updateProgress(0);
					}}
					onPointerDown={event => {
						if (!event.isPrimary || deleting) return;
						setFailure(undefined);
						draggingPointer.current = event.pointerId;
						try {
							event.currentTarget.setPointerCapture(
								event.pointerId
							);
						} catch {
							// A browser may cancel the pointer before capture is established.
						}
						updateFromPointer(event.clientX);
					}}
					onPointerMove={event => {
						if (draggingPointer.current === event.pointerId) {
							updateFromPointer(event.clientX);
						}
					}}
					onPointerUp={finishPointer}
					role="slider"
					style={{
						insetInlineStart: `${progress}%`,
						transform: `translateX(-${progress}%)`,
					}}
					type="button"
				>
					<span aria-hidden="true">→</span>
				</button>
			</div>
			{failure && (
				<p className={style.deleteFailure} role="alert">
					{failure}
				</p>
			)}
		</div>
	);
}

function EntryDateEditor({
	entry,
	onUpdate,
}: {
	readonly entry: JournalEntry;
	readonly onUpdate: (entryID: string, recordedDate: string) => Promise<void>;
}) {
	const recordedDate = journalEntryDate(entry).toPlainDate().toString();
	const [value, setValue] = useState(recordedDate);
	const [saving, setSaving] = useState(false);
	const [failure, setFailure] = useState<string>();
	useEffect(() => setValue(recordedDate), [recordedDate]);

	return (
		<form
			aria-label="Edit recording date"
			className={style.dateEditor}
			onSubmit={event => {
				event.preventDefault();
				if (saving || value === recordedDate) return;
				setSaving(true);
				setFailure(undefined);
				void onUpdate(entry.id, value)
					.catch(error => setFailure(errorMessage(error)))
					.finally(() => setSaving(false));
			}}
		>
			<label>
				<span>Recording date</span>
				<input
					disabled={saving}
					onChange={event => setValue(event.currentTarget.value)}
					required
					type="date"
					value={value}
				/>
			</label>
			<button disabled={saving || value === recordedDate} type="submit">
				{saving ? 'Saving…' : 'Save date'}
			</button>
			{failure && <p role="alert">{failure}</p>}
		</form>
	);
}

function JournalAudio({
	audioURL,
	entry,
	playback,
}: {
	readonly audioURL: string;
	readonly entry: JournalEntry;
	readonly playback: JournalPlayback;
}) {
	const refreshJournal = useRefreshJournal();
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const playRequested = useRef(false);
	const [source, setSource] = useState(audioURL);
	const [recovery, setRecovery] = useState<{
		readonly failedSource: string;
		readonly play: boolean;
		readonly time: number;
	}>();

	useEffect(() => {
		if (!recovery || audioURL === source) return;
		setSource(audioURL);
	}, [audioURL, recovery, source]);

	useEffect(() => {
		if (!recovery || source === recovery.failedSource) return;
		const audio = audioRef.current;
		if (!audio) return;
		const restore = () => {
			if (Math.abs(audio.currentTime - recovery.time) >= 0.25) {
				audio.currentTime = recovery.time;
			}
			setRecovery(undefined);
			if (recovery.play) {
				void audio.play().catch(() => undefined);
			}
		};
		if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
			audio.addEventListener('loadedmetadata', restore, { once: true });
			return () => audio.removeEventListener('loadedmetadata', restore);
		}
		restore();
	}, [recovery, source]);

	return (
		<div className={style.audioDock} data-journal-audio-dock>
			<audio
				className={style.audio}
				controls
				data-entry-id={entry.id}
				data-playback-active={
					playback.activeEntryID === entry.id || undefined
				}
				onEnded={event => {
					playRequested.current = false;
					playback.stopped(entry.id, event.currentTarget.currentTime);
				}}
				onError={event => {
					if (recovery?.failedSource === source) return;
					setRecovery({
						failedSource: source,
						play: playRequested.current,
						time: event.currentTarget.currentTime,
					});
					void refreshJournal().catch(() => setRecovery(undefined));
				}}
				onPause={event => {
					if (!event.currentTarget.error)
						playRequested.current = false;
					playback.stopped(entry.id, event.currentTarget.currentTime);
				}}
				onPlay={() => {
					playRequested.current = true;
					playback.started(entry.id);
				}}
				onTimeUpdate={event =>
					playback.progressed(
						entry.id,
						event.currentTarget.currentTime
					)
				}
				preload="metadata"
				ref={audio => {
					audioRef.current = audio;
					playback.registerAudio(entry.id, audio);
				}}
				src={source}
			/>
		</div>
	);
}

function EntryCard({
	deleteEntry,
	entry,
	playback,
	updateEntryDate,
}: {
	readonly deleteEntry?: (entryID: string) => Promise<void>;
	readonly entry: JournalEntry;
	readonly playback: JournalPlayback;
	readonly updateEntryDate?: (
		entryID: string,
		recordedDate: string
	) => Promise<void>;
}) {
	const title =
		entry.summary?.title ??
		(entry.status === 'failed'
			? 'Processing failed'
			: entry.status === 'ready'
				? 'Untitled entry'
				: entry.status === 'processing'
					? 'Transcribing voice note…'
					: 'Uploading voice note…');
	return (
		<details className={style.entry} id={`entry-${entry.id}`}>
			<summary>
				<LocalizedTime
					className={style.entryTime}
					date={journalEntryDate(entry)}
				/>
				<strong className={style.entryTitle}>{title}</strong>
				{entry.status !== 'ready' && (
					<small className={style.status}>
						{entry.status.replace('_', ' ')}
					</small>
				)}
				<FontAwesomeIcon
					aria-hidden="true"
					className={style.entryChevron}
					icon={faChevronDown}
				/>
			</summary>
			{entry.status === 'processing' && (
				<p className={style.entryProgress} role="status">
					Transcribing voice note…
				</p>
			)}
			{entry.status === 'awaiting_upload' && (
				<p className={style.entryProgress} role="status">
					Uploading voice note…
				</p>
			)}
			{entry.audioUrl && (
				<JournalAudio
					audioURL={entry.audioUrl}
					entry={entry}
					playback={playback}
				/>
			)}
			{entry.error && <p className={style.notice}>{entry.error}</p>}
			{entry.summary && (
				<SummaryCard
					playback={playback}
					showPeriod={false}
					showTitle={false}
					summary={entry.summary}
					timeZone={entry.timeZone}
				/>
			)}
			{entry.transcript.length > 0 && (
				<Transcript entry={entry} playback={playback} />
			)}
			{entry.status === 'ready' && updateEntryDate && (
				<EntryDateEditor entry={entry} onUpdate={updateEntryDate} />
			)}
			{entry.status === 'ready' && deleteEntry && (
				<SwipeToDelete
					entryID={entry.id}
					onDelete={deleteEntry}
					onDeleting={playback.removeEntry}
				/>
			)}
		</details>
	);
}

function PendingEntries({
	entries,
	playback,
}: {
	readonly entries: readonly JournalEntry[];
	readonly playback: JournalPlayback;
}) {
	if (entries.length === 0) return null;
	return (
		<section
			aria-label="Unfinished voice notes"
			className={style.pendingEntries}
		>
			{entries.map(entry => (
				<EntryCard entry={entry} key={entry.id} playback={playback} />
			))}
		</section>
	);
}

const journalSelectionQuery = {
	at: parseAsString,
	year: parseAsString,
	month: parseAsString,
	week: parseAsString,
	day: parseAsString,
};

type JournalSelection = Partial<
	Record<'at' | 'year' | 'month' | 'week' | 'day', string>
>;
type AggregatePeriod = Exclude<JournalSummary['period'], 'entry' | 'journal'>;

interface JournalPeriodNode {
	readonly end: string;
	readonly id: string;
	readonly period: AggregatePeriod;
	readonly start: string;
	readonly summary?: JournalSummary;
}

function periodContains(period: JournalPeriodNode, timestamp: string) {
	const value = Date.parse(timestamp);
	return value >= Date.parse(period.start) && value < Date.parse(period.end);
}

function periodBounds(entry: JournalEntry, period: AggregatePeriod) {
	const recordedAt = journalEntryDate(entry);
	let start: Temporal.ZonedDateTime;
	switch (period) {
		case 'day':
			start = recordedAt.startOfDay();
			break;
		case 'week':
			start = recordedAt.startOfDay().subtract({
				days: recordedAt.dayOfWeek - 1,
			});
			break;
		case 'month':
			start = recordedAt.with({ day: 1 }).startOfDay();
			break;
		case 'year':
			start = recordedAt.with({ day: 1, month: 1 }).startOfDay();
			break;
	}
	const end =
		period === 'day'
			? start.add({ days: 1 })
			: period === 'week'
				? start.add({ days: 7 })
				: period === 'month'
					? start.add({ months: 1 })
					: start.add({ years: 1 });
	const options = {
		smallestUnit: 'second',
	} as const;
	return {
		end: end.toInstant().toString(options),
		start: start.toInstant().toString(options),
	};
}

function periodsFor(journal: Journal, period: AggregatePeriod) {
	const nodes = new Map<number, JournalPeriodNode>();
	for (const entry of journal.entries) {
		if (
			!['awaiting_upload', 'processing', 'ready'].includes(entry.status)
		) {
			continue;
		}
		const bounds = periodBounds(entry, period);
		const start = Date.parse(bounds.start);
		nodes.set(start, {
			...bounds,
			id: `${period}:${bounds.start}`,
			period,
		});
	}
	for (const summary of journal.summaries) {
		if (summary.period !== period) continue;
		const start = Date.parse(summary.start);
		const existing = nodes.get(start);
		nodes.set(start, {
			end: summary.end,
			id: summary.id,
			period,
			start: summary.start,
			summary,
			...(!existing ? {} : { end: existing.end, start: existing.start }),
		});
	}
	return [...nodes.values()].sort(
		(a, b) => Date.parse(b.start) - Date.parse(a.start)
	);
}

function containingPeriod(
	journal: Journal,
	period: AggregatePeriod,
	timestamp: string
) {
	return periodsFor(journal, period).find(node =>
		periodContains(node, timestamp)
	);
}

function journalHref(route: JournalRoute, selection: JournalSelection = {}) {
	const pathname = `/journal/${route}`;
	const query = new URLSearchParams(
		Object.entries(selection).filter(
			(value): value is [string, string] => value[1] !== undefined
		)
	);
	return query.size > 0 ? `${pathname}?${query}` : pathname;
}

function periodMidpoint(period: JournalPeriodNode) {
	return new Date(
		(Date.parse(period.start) + Date.parse(period.end)) / 2
	).toISOString();
}

function citationDestination(journal: Journal, entryID: string) {
	const entry = journal.entries.find(value => value.id === entryID);
	if (!entry) return '/journal';
	return journalHref('day', { at: entry.recordedAt });
}

const journalViews = [undefined, 'year', 'month', 'week', 'day'] as const;

function zoomLevelLabel(route: JournalRoute | undefined) {
	if (route === undefined) return 'Overview';
	return `${route.charAt(0).toUpperCase()}${route.slice(1)}s`;
}

function ZoomNavigation({
	focus,
	route,
}: {
	readonly focus: string;
	readonly route?: JournalRoute;
}) {
	const [visibleRoute, setVisibleRoute] = useState(route);
	const navigation = useRef<HTMLElement>(null);
	const [indicator, setIndicator] = useState({
		inlineSize: 0,
		offset: 0,
	});
	useEffect(() => setVisibleRoute(route), [route]);
	useLayoutEffect(() => {
		const navigationElement = navigation.current;
		const selected = navigationElement?.querySelector<HTMLAnchorElement>(
			`a[data-journal-view="${visibleRoute ?? 'overview'}"]`
		);
		if (!navigationElement || !selected) return;
		const updateIndicator = () => {
			const navigationBounds = navigationElement.getBoundingClientRect();
			const selectedBounds = selected.getBoundingClientRect();
			setIndicator({
				inlineSize: selectedBounds.width,
				offset:
					selectedBounds.left -
					navigationBounds.left +
					navigationElement.scrollLeft,
			});
		};
		updateIndicator();
		const observer = new ResizeObserver(updateIndicator);
		observer.observe(navigationElement);
		observer.observe(selected);
		return () => observer.disconnect();
	}, [visibleRoute]);
	const href = (destination: JournalRoute | undefined) =>
		destination
			? journalHref(destination, { at: focus })
			: `/journal?${new URLSearchParams({ at: focus })}`;
	return (
		<nav
			aria-label="Browse journal"
			className={style.zoomNavigation}
			ref={navigation}
		>
			<span
				aria-hidden="true"
				className={style.zoomIndicator}
				data-ready={indicator.inlineSize > 0 ? '' : undefined}
				data-journal-view-indicator
				style={{
					inlineSize: indicator.inlineSize,
					transform: `translateX(${indicator.offset}px)`,
				}}
			/>
			{journalViews.map(destination => (
				<Link
					aria-current={
						destination === visibleRoute ? 'page' : undefined
					}
					data-journal-view={destination ?? 'overview'}
					href={href(destination)}
					key={destination ?? 'overview'}
					onClick={event => {
						if (
							event.button === 0 &&
							!event.metaKey &&
							!event.ctrlKey &&
							!event.shiftKey &&
							!event.altKey
						) {
							setVisibleRoute(destination);
						}
					}}
				>
					{zoomLevelLabel(destination)}
				</Link>
			))}
		</nav>
	);
}

function PeriodList({
	deleteEntry,
	focus,
	journal,
	nextRoute,
	period,
	playback,
	setFocus,
	updateEntryDate,
}: {
	readonly deleteEntry?: (entryID: string) => Promise<void>;
	readonly focus: string;
	readonly journal: Journal;
	readonly nextRoute?: JournalRoute;
	readonly period: AggregatePeriod;
	readonly playback: JournalPlayback;
	readonly setFocus: (focus: string) => void;
	readonly updateEntryDate?: (
		entryID: string,
		recordedDate: string
	) => Promise<void>;
}) {
	const periods = useMemo(
		() => periodsFor(journal, period),
		[journal, period]
	);
	const listRef = useRef<HTMLDivElement>(null);
	const positionedPeriod = useRef<AggregatePeriod>();
	const focusRef = useRef(focus);
	focusRef.current = focus;

	useEffect(() => {
		const fallbackPeriod = periods[0];
		if (positionedPeriod.current === period || fallbackPeriod === undefined)
			return;
		positionedPeriod.current = period;
		const frame = window.requestAnimationFrame(() => {
			const element = listRef.current?.querySelector<HTMLElement>(
				`[data-journal-period-start="${CSS.escape(
					containingPeriod(journal, period, focusRef.current)
						?.start ?? fallbackPeriod.start
				)}"]`
			);
			if (!element) return;
			const node = periods.find(
				candidate =>
					candidate.start === element.dataset.journalPeriodStart
			);
			if (!node) return;
			const duration = Date.parse(node.end) - Date.parse(node.start);
			const fraction = Math.max(
				0,
				Math.min(
					1,
					(Date.parse(focusRef.current) - Date.parse(node.start)) /
						duration
				)
			);
			const bounds = element.getBoundingClientRect();
			window.scrollTo({
				behavior: 'auto',
				top:
					window.scrollY +
					bounds.top +
					bounds.height * fraction -
					window.innerHeight / 2,
			});
		});
		return () => window.cancelAnimationFrame(frame);
	}, [journal, period, periods]);

	useEffect(() => {
		let frame = 0;
		const update = () => {
			frame = 0;
			const elements = Array.from(
				listRef.current?.querySelectorAll<HTMLElement>(
					'[data-journal-period-start]'
				) ?? []
			);
			if (elements.length === 0) return;
			const viewportMiddle = window.innerHeight / 2;
			const element = elements.reduce((closest, candidate) => {
				const bounds = candidate.getBoundingClientRect();
				const distance =
					viewportMiddle < bounds.top
						? bounds.top - viewportMiddle
						: viewportMiddle > bounds.bottom
							? viewportMiddle - bounds.bottom
							: 0;
				const closestBounds = closest.getBoundingClientRect();
				const closestDistance =
					viewportMiddle < closestBounds.top
						? closestBounds.top - viewportMiddle
						: viewportMiddle > closestBounds.bottom
							? viewportMiddle - closestBounds.bottom
							: 0;
				return distance < closestDistance ? candidate : closest;
			});
			const node = periods.find(
				candidate =>
					candidate.start === element.dataset.journalPeriodStart
			);
			if (!node) return;
			const bounds = element.getBoundingClientRect();
			const fraction = Math.max(
				0,
				Math.min(1, (viewportMiddle - bounds.top) / bounds.height)
			);
			const timestamp = new Date(
				Date.parse(node.start) +
					(Date.parse(node.end) - Date.parse(node.start)) * fraction
			).toISOString();
			if (timestamp !== focusRef.current) {
				focusRef.current = timestamp;
				setFocus(timestamp);
			}
		};
		const scheduleUpdate = () => {
			if (frame === 0) frame = window.requestAnimationFrame(update);
		};
		window.addEventListener('scroll', scheduleUpdate, { passive: true });
		window.addEventListener('resize', scheduleUpdate);
		scheduleUpdate();
		return () => {
			window.removeEventListener('scroll', scheduleUpdate);
			window.removeEventListener('resize', scheduleUpdate);
			if (frame !== 0) window.cancelAnimationFrame(frame);
		};
	}, [periods, setFocus]);

	if (periods.length === 0) {
		return <p className={style.empty}>No {period}s yet.</p>;
	}
	return (
		<div className={style.periodList} ref={listRef}>
			{periods.map(node => (
				<section
					className={style.period}
					data-journal-period-start={node.start}
					key={node.id}
				>
					<h3>
						{nextRoute ? (
							<Link
								data-journal-period-link={period}
								href={journalHref(nextRoute, {
									at: periodMidpoint(node),
								})}
							>
								<PeriodDate summary={node} />
							</Link>
						) : (
							<PeriodDate summary={node} />
						)}
					</h3>
					{node.summary && (
						<SummaryCard
							playback={playback}
							showPeriod={false}
							summary={node.summary}
						/>
					)}
					{period === 'day' &&
						journal.entries
							.filter(
								entry =>
									entry.status === 'ready' &&
									periodContains(node, entry.recordedAt)
							)
							.map(entry => (
								<EntryCard
									deleteEntry={deleteEntry}
									entry={entry}
									key={entry.id}
									playback={playback}
									updateEntryDate={updateEntryDate}
								/>
							))}
				</section>
			))}
		</div>
	);
}

function RecentEntries({ journal }: { readonly journal: Journal }) {
	const entries = [...journal.entries]
		.filter(entry => entry.status === 'ready')
		.sort(
			(a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
		)
		.slice(0, 5);
	if (entries.length === 0) return null;
	return (
		<section aria-labelledby="recent-journal-entries" className={style.recent}>
			<header>
				<h2 id="recent-journal-entries">Recent entries</h2>
				<Link href={journalHref('day', { at: entries[0]?.recordedAt })}>
					View all days
				</Link>
			</header>
			<ol>
				{entries.map(entry => (
					<li key={entry.id}>
						<Link href={journalHref('day', { at: entry.recordedAt })}>
							<span className={style.recentDate}>
								<LocalizedDate date={journalEntryDate(entry)} />
							</span>
							<strong>
								{entry.summary?.title ?? 'Untitled entry'}
							</strong>
							<span className={style.recentTime}>
								<LocalizedTime date={journalEntryDate(entry)} />
							</span>
						</Link>
					</li>
				))}
			</ol>
		</section>
	);
}

function JournalBrowser({
	deleteEntry,
	journal,
	route,
	updateEntryDate,
}: {
	readonly deleteEntry?: (entryID: string) => Promise<void>;
	readonly journal: Journal;
	readonly route?: JournalRoute;
	readonly updateEntryDate?: (
		entryID: string,
		recordedDate: string
	) => Promise<void>;
}) {
	const [rawSelection, setRawSelection] = useQueryStates(
		journalSelectionQuery,
		{
			history: 'replace',
			shallow: true,
			throttleMs: 250,
		}
	);
	const aggregateCitationDestination = useCallback(
		(entryID: string) => citationDestination(journal, entryID),
		[journal]
	);
	const playback = useJournalPlayback(
		journal,
		aggregateCitationDestination,
		route ?? 'overview'
	);
	const pendingEntries = journal.entries.filter(entry =>
		['awaiting_upload', 'processing'].includes(entry.status)
	);
	const legacyFocus = (['day', 'week', 'month', 'year'] as const)
		.map(period =>
			periodsFor(journal, period).find(
				node => node.id === rawSelection[period]
			)
		)
		.find(node => node !== undefined)?.start;
	const newestEntry = journal.entries
		.filter(entry => entry.status !== 'failed')
		.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
	const focus =
		rawSelection.at ??
		legacyFocus ??
		newestEntry?.recordedAt ??
		new Date().toISOString();
	const setFocus = useCallback(
		(next: string) => {
			void setRawSelection({ at: next }, { history: 'replace' });
		},
		[setRawSelection]
	);

	if (route === undefined) {
		const readyEntries = journal.entries.filter(
			entry => entry.status === 'ready'
		);
		const summary =
			journal.summaries.find(value => value.period === 'journal') ??
			(readyEntries.length === 1
				? readyEntries.at(0)?.summary
				: undefined);
		return (
			<div>
				<ZoomNavigation focus={focus} />
				<PendingEntries entries={pendingEntries} playback={playback} />
				{summary ? (
					<SummaryCard
						playback={playback}
						showPeriod={false}
						summary={summary}
					/>
				) : readyEntries.length > 1 ? (
					<p className={style.empty} role="status">
						Preparing the journal overview…
					</p>
				) : (
					<p className={style.empty}>
						Your journal overview will grow as you add entries.
					</p>
				)}
				<RecentEntries journal={journal} />
			</div>
		);
	}

	const nextRoute: Partial<Record<JournalRoute, JournalRoute>> = {
		year: 'month',
		month: 'week',
		week: 'day',
	};
	return (
		<div>
			<ZoomNavigation focus={focus} route={route} />
			<PendingEntries entries={pendingEntries} playback={playback} />
			<PeriodList
				deleteEntry={deleteEntry}
				focus={focus}
				journal={journal}
				nextRoute={nextRoute[route]}
				period={route}
				playback={playback}
				setFocus={setFocus}
				updateEntryDate={updateEntryDate}
			/>
		</div>
	);
}

function normalizedContentType(blob: Blob): JournalContentType {
	const type = blob.type.split(';').at(0)?.toLowerCase() ?? '';
	if (type === 'audio/x-m4a' || type === 'audio/aac') return 'audio/mp4';
	if (
		type === 'audio/mp4' ||
		type === 'audio/mpeg' ||
		type === 'audio/ogg' ||
		type === 'audio/wav' ||
		type === 'audio/webm'
	) {
		return type;
	}
	if (blob instanceof File) {
		const extension = blob.name.toLowerCase().split('.').at(-1);
		if (extension === 'm4a' || extension === 'mp4' || extension === 'aac') {
			return 'audio/mp4';
		}
		if (extension === 'mp3') return 'audio/mpeg';
		if (extension === 'ogg' || extension === 'oga') return 'audio/ogg';
		if (extension === 'wav' || extension === 'wave') return 'audio/wav';
		if (extension === 'webm') return 'audio/webm';
	}
	throw new Error(`Unsupported audio type: ${blob.type || 'unknown'}.`);
}

function transferredFiles(transfer: DataTransfer): File[] {
	const itemFiles = Array.from(transfer.items)
		.filter(item => item.kind === 'file')
		.map(item => item.getAsFile())
		.filter((file): file is File => file !== null);
	return itemFiles.length > 0 ? itemFiles : Array.from(transfer.files);
}

function containsFiles(
	transfer: DataTransfer | null
): transfer is DataTransfer {
	return (
		transfer !== null &&
		(Array.from(transfer.types).includes('Files') ||
			Array.from(transfer.items).some(item => item.kind === 'file'))
	);
}

function RecordingWaveform({ stream }: { readonly stream: MediaStream }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const audioContext = new AudioContext();
		const analyser = audioContext.createAnalyser();
		const source = audioContext.createMediaStreamSource(stream);
		const levels: number[] = [];
		let animationFrame = 0;
		let lastSampledAt = 0;

		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.7;
		const samples = new Uint8Array(analyser.fftSize);
		source.connect(analyser);

		const resize = () => {
			const bounds = canvas.getBoundingClientRect();
			const scale = window.devicePixelRatio || 1;
			canvas.width = Math.max(1, Math.round(bounds.width * scale));
			canvas.height = Math.max(1, Math.round(bounds.height * scale));
		};
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		resize();

		const draw = (now: number) => {
			if (now - lastSampledAt >= 45) {
				analyser.getByteTimeDomainData(samples);
				let peak = 0;
				for (const sample of samples) {
					peak = Math.max(peak, Math.abs(sample - 128) / 128);
				}
				levels.push(Math.max(0.06, Math.min(1, peak * 1.8)));
				lastSampledAt = now;
			}

			const context = canvas.getContext('2d');
			if (context) {
				const scale = window.devicePixelRatio || 1;
				const barWidth = 2 * scale;
				const gap = 2 * scale;
				const capacity = Math.max(
					1,
					Math.floor(canvas.width / (barWidth + gap))
				);
				if (levels.length > capacity) {
					levels.splice(0, levels.length - capacity);
				}

				context.clearRect(0, 0, canvas.width, canvas.height);
				context.fillStyle = getComputedStyle(canvas).color;
				levels.forEach((level, index) => {
					const height = Math.max(
						2 * scale,
						level * canvas.height * 0.86
					);
					const x =
						canvas.width -
						(levels.length - index) * (barWidth + gap);
					context.fillRect(
						x,
						(canvas.height - height) / 2,
						barWidth,
						height
					);
				});
			}

			animationFrame = requestAnimationFrame(draw);
		};

		void audioContext.resume();
		animationFrame = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			source.disconnect();
			void audioContext.close();
		};
	}, [stream]);

	return (
		<canvas
			aria-label="Live recording waveform"
			className={style.waveform}
			ref={canvasRef}
			role="img"
		/>
	);
}

function DevelopmentJournalTools() {
	const refreshJournal = useRefreshJournal();
	const [status, setStatus] = useState<
		'idle' | 'seeding' | 'complete' | 'failed'
	>('idle');
	return (
		// Inline styles let production dead-code elimination remove this
		// development-only control without leaving rules in the CSS bundle.
		<aside
			className={style.notice}
			style={{
				background: 'color-mix(in srgb, #ffcc00 12%, transparent)',
				borderRadius: '0.75rem',
				flexWrap: 'wrap',
				marginBlock: '1em 1.5em',
				maxWidth: '42em',
			}}
		>
			<div style={{ display: 'grid', flex: 1, gap: '0.15em' }}>
				<strong>Development journal</strong>
				<small>Local sample entries never leave this dev server.</small>
			</div>
			<button
				disabled={status === 'seeding'}
				onClick={() => {
					setStatus('seeding');
					void fetch(`${ZEMN_ME_API_BASE}/__local/journal/seed`, {
						method: 'POST',
					})
						.then(response => {
							if (!response.ok)
								throw new Error('Could not add sample entries.');
							return refreshJournal();
						})
						.then(() => setStatus('complete'))
						.catch(() => setStatus('failed'));
				}}
				style={{
					background: 'transparent',
					border: '1px solid currentColor',
					borderRadius: '999px',
					cursor: status === 'seeding' ? 'wait' : 'pointer',
					font: 'inherit',
					fontWeight: 700,
					padding: '0.5em 0.8em',
				}}
				type="button"
			>
				{status === 'seeding' ? 'Adding entries…' : 'Add sample entries'}
			</button>
			{status === 'complete' && (
				<small role="status" style={{ flexBasis: '100%' }}>
					Sample journal ready
				</small>
			)}
			{status === 'failed' && (
				<small
					role="alert"
					style={{
						color: 'var(--journal-recording)',
						flexBasis: '100%',
					}}
				>
					Could not add sample entries
				</small>
			)}
		</aside>
	);
}

export default function JournalPageClient({
	route,
}: {
	readonly route?: JournalRoute;
}) {
	const [idToken, , promptForLoginFuture] = useZemnMeAuth();
	const scopes = useGetMeScopes(idToken);
	const journal = useGetJournal(idToken);
	const createEntry = usePostJournalEntry(idToken);
	const deleteEntry = useDeleteJournalEntry(idToken);
	const updateEntryDate = useUpdateJournalEntryDate(idToken);
	const createJournalEntry = createEntry.mutateAsync;
	const deleteJournalEntry = deleteEntry.mutateAsync;
	const updateJournalEntryDate = useCallback(
		(entryId: string, recordedDate: string) =>
			updateEntryDate
				.mutateAsync({ entryId, recordedDate })
				.then(() => undefined),
		[updateEntryDate]
	);
	const resetCreateEntry = createEntry.reset;
	const recorder = useRef<MediaRecorder>();
	const recordingDisposition = useRef<'discard' | 'submit'>('discard');
	const chunks = useRef<Blob[]>([]);
	const [recording, setRecording] = useState(false);
	const [recordingStream, setRecordingStream] = useState<MediaStream>();
	const [recordingError, setRecordingError] = useState<string>();
	const [draggingFile, setDraggingFile] = useState(false);
	const dragDepth = useRef(0);
	const hasReadScope = scopes(
		values => values.includes(journalReadScope),
		() => false,
		() => false
	);
	const hasWriteScope = scopes(
		values => values.includes(journalWriteScope),
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
	const status = createEntry.isPending
		? 'Uploading your private voice note…'
		: recordingError;
	useEffect(() => {
		if (!recordingError) return;
		const timeout = window.setTimeout(
			() => setRecordingError(undefined),
			uploadErrorLifetimeMs
		);
		return () => window.clearTimeout(timeout);
	}, [recordingError]);
	const resetSubmission = useCallback(() => {
		resetCreateEntry();
		setRecordingError(undefined);
	}, [resetCreateEntry]);

	const submitAudio = useCallback(
		async (blob: Blob, recordedAt: Date) => {
			resetSubmission();
			if (blob.size <= 0 || blob.size > maxJournalAudioBytes) {
				throw new Error(
					'Voice notes must be between 1 byte and 25 MiB.'
				);
			}
			await createJournalEntry({
				file: blob,
				contentType: normalizedContentType(blob),
				recordedAt: recordedAt.toISOString(),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			});
		},
		[createJournalEntry, resetSubmission]
	);

	const submitFiles = useCallback(
		async (files: readonly File[]) => {
			for (const file of files) {
				await submitAudio(
					file,
					new Date(file.lastModified || Date.now())
				);
			}
		},
		[submitAudio]
	);

	useEffect(() => {
		if (!hasWriteScope) return;

		// Chrome may not expose a macOS promised file until after the page
		// accepts dragover, so file inspection must wait until drop.
		const showDropTarget = (event: DragEvent) => {
			event.preventDefault();
			dragDepth.current += 1;
			setDraggingFile(true);
		};
		const allowDrop = (event: DragEvent) => {
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		};
		const hideDropTarget = (event: DragEvent) => {
			event.preventDefault();
			dragDepth.current = Math.max(0, dragDepth.current - 1);
			if (dragDepth.current === 0) setDraggingFile(false);
		};
		const dropFiles = (event: DragEvent) => {
			event.preventDefault();
			dragDepth.current = 0;
			setDraggingFile(false);
			if (!containsFiles(event.dataTransfer)) return;
			const files = transferredFiles(event.dataTransfer);
			if (files.length > 0) {
				void submitFiles(files).catch(error =>
					setRecordingError(errorMessage(error))
				);
			}
		};
		const pasteFiles = (event: ClipboardEvent) => {
			if (!event.clipboardData) return;
			const files = transferredFiles(event.clipboardData);
			if (files.length === 0) return;
			event.preventDefault();
			void submitFiles(files).catch(error =>
				setRecordingError(errorMessage(error))
			);
		};

		document.addEventListener('dragenter', showDropTarget);
		document.addEventListener('dragover', allowDrop);
		document.addEventListener('dragleave', hideDropTarget);
		document.addEventListener('drop', dropFiles);
		document.addEventListener('paste', pasteFiles);
		return () => {
			document.removeEventListener('dragenter', showDropTarget);
			document.removeEventListener('dragover', allowDrop);
			document.removeEventListener('dragleave', hideDropTarget);
			document.removeEventListener('drop', dropFiles);
			document.removeEventListener('paste', pasteFiles);
			dragDepth.current = 0;
		};
	}, [hasWriteScope, submitFiles]);

	const startRecording = async () => {
		resetSubmission();
		let stream: MediaStream | undefined;
		try {
			const activeStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			stream = activeStream;
			const mediaRecorder = new MediaRecorder(activeStream);
			recorder.current = mediaRecorder;
			recordingDisposition.current = 'discard';
			chunks.current = [];
			mediaRecorder.ondataavailable = event => {
				if (event.data.size > 0) chunks.current.push(event.data);
			};
			mediaRecorder.onstop = () => {
				const disposition = recordingDisposition.current;
				const recordedChunks = chunks.current;
				chunks.current = [];
				recorder.current = undefined;
				activeStream.getTracks().forEach(track => track.stop());
				setRecordingStream(undefined);
				setRecording(false);
				if (disposition === 'submit') {
					const blob = new Blob(recordedChunks, {
						type: mediaRecorder.mimeType,
					});
					void submitAudio(blob, new Date()).catch(error =>
						setRecordingError(errorMessage(error))
					);
				}
			};
			mediaRecorder.start();
			setRecordingStream(activeStream);
			setRecording(true);
		} catch (error) {
			stream?.getTracks().forEach(track => track.stop());
			setRecordingError(errorMessage(error));
		}
	};

	const endRecording = (disposition: 'discard' | 'submit') => {
		const mediaRecorder = recorder.current;
		if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
		recordingDisposition.current = disposition;
		mediaRecorder.stop();
		setRecordingStream(undefined);
		setRecording(false);
	};

	const uploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = '';
		if (files.length === 0) return;
		void submitFiles(files).catch(error =>
			setRecordingError(errorMessage(error))
		);
	};

	return (
		<main
			className={`${style.page} ${draggingFile ? style.dropTarget : ''}`}
			data-journal-drop-active={draggingFile || undefined}
		>
			{draggingFile && (
				<div className={style.dropOverlay} role="status">
					<FontAwesomeIcon icon={faUpload} />
					Drop voice memo
				</div>
			)}
			<header className={style.hero}>
				<h1>Journal</h1>
				<p>A private record, in your own voice.</p>
			</header>
			{!isLoggedIn ? (
				<button
					aria-label="Authenticate with OIDC"
					disabled={promptForLogin === undefined}
					onClick={() => void promptForLogin?.()}
					type="button"
				>
					Sign in to open your journal
				</button>
			) : !hasReadScope ? (
				<p className={style.notice}>
					<FontAwesomeIcon icon={faTriangleExclamation} />
					This journal is restricted to its owner.
				</p>
			) : (
				<>
					{hasWriteScope && (
						<section
							aria-label="Create a journal entry"
							className={style.recorder}
						>
							<button
								aria-label={
									recording ? 'Submit note' : 'Record a note'
								}
								className={
									recording ? style.submitButton : undefined
								}
								disabled={createEntry.isPending}
								onClick={
									recording
										? () => endRecording('submit')
										: startRecording
								}
								type="button"
							>
								<FontAwesomeIcon
									icon={
										recording ? faCheck : faMicrophone
									}
								/>
								<span className={style.actionLabel}>
									{recording ? 'Done' : 'Record'}
								</span>
							</button>
							{recordingStream ? (
								<>
									<RecordingWaveform
										stream={recordingStream}
									/>
									<button
										aria-label="Cancel recording"
										className={style.cancelButton}
										onClick={() => endRecording('discard')}
										type="button"
									>
										<FontAwesomeIcon icon={faStop} />
										<span className={style.actionLabel}>
											Cancel
										</span>
									</button>
								</>
							) : (
								<label
									className={style.uploadButton}
									title="Import voice memo"
								>
									<FontAwesomeIcon icon={faUpload} />
									<span className={style.actionLabel}>Import</span>
									<input
										accept="audio/*,.m4a"
										aria-label="Import voice memo"
										disabled={createEntry.isPending}
										multiple
										onChange={uploadFiles}
										type="file"
									/>
								</label>
							)}
							{status && <p>{status}</p>}
						</section>
					)}
					{isDevelopment && <DevelopmentJournalTools />}
					{journal(
						value => (
							<JournalBrowser
								deleteEntry={
									hasWriteScope
										? deleteJournalEntry
										: undefined
								}
								journal={value}
								route={route}
								updateEntryDate={
									hasWriteScope
										? updateJournalEntryDate
										: undefined
								}
							/>
						),
						() => (
							<p>Loading your journal…</p>
						),
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
