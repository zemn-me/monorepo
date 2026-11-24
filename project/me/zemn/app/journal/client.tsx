'use client';

import {
	faBookOpen,
	faCalendarDays,
	faChevronDown,
	faEllipsis,
	faMicrophone,
	faPause,
	faPlay,
	faSpinner,
	faTrashCan,
	faTriangleExclamation,
	faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	ChangeEvent,
	type ComponentProps,
	memo,
	KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	Outlet,
	useLocation,
	useOutletContext,
	useSearchParams,
} from 'react-router';
import { Temporal } from 'temporal-polyfill';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { JournalMap } from '#root/project/me/zemn/app/journal/location_map.js';
import { JournalMCPSetup } from '#root/project/me/zemn/app/journal/mcp_setup.js';
import {
	childPeriodsFor,
	journalBrowseQuery,
} from '#root/project/me/zemn/app/journal/periods.js';
import {
	followsLinkNormally,
	type JournalCitationPlayback,
	type JournalPlayback,
	JournalPlayerProvider,
	journalPlaybackHref,
	mediaTimestamp,
	useJournalPlayer,
} from '#root/project/me/zemn/app/journal/player.js';
import { JournalProcessingStatus } from '#root/project/me/zemn/app/journal/processing_status.js';
import {
	type RecordingSession,
	startLocalRecording,
} from '#root/project/me/zemn/app/journal/recording.js';
import {
	LocalRecordings,
	useRecordingQueue,
} from '#root/project/me/zemn/app/journal/recording_queue.js';
import { type LocalRecording } from '#root/project/me/zemn/app/journal/recording_store.js';
import { useJournalRenderTime } from '#root/project/me/zemn/app/journal/render_time.js';
import {
	JournalPlaceholder,
	JournalProgress,
	JournalStatus,
} from '#root/project/me/zemn/app/journal/status.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import { Markdown } from '#root/project/me/zemn/components/Article/markdown.js';
import {
	type MarkdownComponents,
	markdownComponents,
} from '#root/project/me/zemn/components/Article/markdown_components.js';
import { FootnotePreviews } from '#root/project/me/zemn/components/FootnotePreviews/footnote_previews.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import { useSessionClaims } from '#root/project/me/zemn/hook/server_session.js';
import {
	useDeleteJournalEntry,
	useGetJournal,
	useGetJournalUploads,
	useGetJournalWikiIndex,
	useGetJournalWikiPage,
	useGetMeScopes,
	usePostJournalEntry,
	useRefreshJournal,
	useUpdateJournalEntryDate,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import {
	Date as LocalizedDate,
	DateRange as LocalizedDateRange,
	Time as LocalizedTime,
	MonthYear,
} from '#root/ts/react/lang/date.js';
import { useLocale } from '#root/ts/react/lang/useLocale.js';

type Journal = components['schemas']['Journal'];
type JournalCitation = components['schemas']['JournalCitation'];
type JournalWikiPageView = components['schemas']['JournalWikiPageView'];
type JournalWikiIndex = components['schemas']['JournalWikiIndex'];
type JournalCurationStatus = components['schemas']['JournalCurationStatus'];
type JournalEntry = components['schemas']['JournalEntry'];
type JournalSummary = components['schemas']['JournalSummary'];
type JournalSummaryBlock = components['schemas']['JournalSummaryBlock'];
type JournalContentType =
	components['schemas']['JournalEntryCreate']['contentType'];

export type JournalRoute = 'year' | 'month' | 'week' | 'day';

const journalReadScope = 'journal_read';
const journalWriteScope = 'journal_write';
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
	readonly summary: Pick<JournalSummary, 'end' | 'period' | 'start'>;
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
				<LocalizedDateRange end={new Date(summary.end)} start={start} />
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
			<LocalizedDateRange
				end={Temporal.Instant.from(summary.end).toZonedDateTimeISO(
					timeZone
				)}
				start={start}
			/>
		);
	}
	return <LocalizedDate date={start} />;
}

function journalEntryDate(entry: JournalEntry): Temporal.ZonedDateTime {
	return Temporal.Instant.from(entry.recordedAt).toZonedDateTimeISO(
		entry.timeZone
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
	readonly playback: JournalCitationPlayback;
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
	const components = useMemo<MarkdownComponents>(
		() => ({
			h2: markdownComponents.h4,
			h3: markdownComponents.h5,
			a: ({ children, href, node: _node, ...props }) => {
				const Anchor = markdownComponents.a;
				const resolved = href ? linksByHref.get(href) : undefined;
				if (!resolved)
					return (
						<Link {...props} href={href}>
							{children}
						</Link>
					);
				const { citationID, link } = resolved;
				const { citation } = link;
				return (
					<sup className={style.citation}>
						<Anchor
							{...props}
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
						</Anchor>
					</sup>
				);
			},
		}),
		[linksByHref, playback.playSegment]
	);

	return (
		<div data-journal-summary-block>
			<Markdown components={components}>{markdown}</Markdown>
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
	readonly playback: JournalCitationPlayback;
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
							<PeriodDate summary={summary} timeZone={timeZone} />
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
					“{link.quote}” <Link href={link.href}>{link.label}</Link>
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
	const draggingPointer = useRef<number | undefined>(undefined);
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
	const editorID = `entry-${entry.id}-recording-date-editor`;
	const [value, setValue] = useState(recordedDate);
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [failure, setFailure] = useState<string>();
	useEffect(() => setValue(recordedDate), [recordedDate]);
	const cancel = () => {
		setValue(recordedDate);
		setFailure(undefined);
		setEditing(false);
	};

	if (!editing) {
		return (
			<div className={style.dateEditorDisclosure}>
				<button
					aria-controls={editorID}
					aria-expanded="false"
					onClick={() => {
						setFailure(undefined);
						setEditing(true);
					}}
					type="button"
				>
					Edit recording date
				</button>
			</div>
		);
	}

	return (
		<form
			aria-label="Edit recording date"
			className={style.dateEditor}
			id={editorID}
			onKeyDown={event => {
				if (event.key !== 'Escape' || saving) return;
				event.preventDefault();
				cancel();
			}}
			onSubmit={event => {
				event.preventDefault();
				if (saving || value === recordedDate) return;
				setSaving(true);
				setFailure(undefined);
				void onUpdate(entry.id, value)
					.then(() => setEditing(false))
					.catch(error => setFailure(errorMessage(error)))
					.finally(() => setSaving(false));
			}}
		>
			<label>
				<span>Recording date</span>
				<input
					autoFocus
					disabled={saving}
					onChange={event => setValue(event.currentTarget.value)}
					required
					type="date"
					value={value}
				/>
			</label>
			<div className={style.dateEditorActions}>
				<button
					disabled={saving || value === recordedDate}
					type="submit"
				>
					{saving ? 'Saving…' : 'Save date'}
				</button>
				<button
					className={style.dateEditorCancel}
					disabled={saving}
					onClick={cancel}
					type="button"
				>
					Cancel
				</button>
			</div>
			{failure && <p role="alert">{failure}</p>}
		</form>
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
	const title = entry.title ?? entry.summary?.title ?? 'Voice note';
	return (
		<article
			aria-labelledby={`entry-title-${entry.id}`}
			className={style.entry}
			id={`entry-${entry.id}`}
		>
			<header className={style.entryHeading}>
				<h3 id={`entry-title-${entry.id}`}>{title}</h3>
				{entry.audioUrl && (
					<button
						type="button"
						className={style.entryPlay}
						aria-label={`${playback.playingEntryID === entry.id ? 'Pause' : 'Play'} ${title}`}
						title={
							playback.playingEntryID === entry.id
								? 'Pause recording'
								: 'Play recording'
						}
						onClick={() => playback.toggle(entry)}
					>
						<FontAwesomeIcon
							aria-hidden="true"
							icon={
								playback.playingEntryID === entry.id
									? faPause
									: faPlay
							}
						/>
					</button>
				)}
				<LocalizedTime
					className={style.entryTime}
					date={journalEntryDate(entry)}
				/>
				{entry.status === 'ready' &&
					(updateEntryDate || deleteEntry) && (
						<details className={style.entryOptions}>
							<summary
								aria-label="Recording options"
								title="Recording options"
							>
								<FontAwesomeIcon
									aria-hidden="true"
									icon={faEllipsis}
								/>
							</summary>
							{updateEntryDate && (
								<EntryDateEditor
									entry={entry}
									onUpdate={updateEntryDate}
								/>
							)}
							{deleteEntry && (
								<SwipeToDelete
									entryID={entry.id}
									onDelete={deleteEntry}
									onDeleting={playback.removeEntry}
								/>
							)}
						</details>
					)}
			</header>
			{entry.status === 'processing' ? (
				<JournalProcessingStatus progress={entry.processingProgress} />
			) : (
				entry.status !== 'ready' && (
					<JournalStatus
						label={
							entry.status === 'failed'
								? 'Processing failed'
								: 'Uploading voice note'
						}
						state={entry.status === 'failed' ? 'error' : 'busy'}
					/>
				)
			)}
			{['processing', 'awaiting_upload'].includes(entry.status) && (
				<JournalPlaceholder
					label={
						entry.status === 'processing'
							? entry.processingProgress?.stage === 'summarizing'
								? 'Preparing summary'
								: 'Preparing transcript'
							: 'Uploading audio'
					}
				/>
			)}
			{(entry.error || entry.status === 'failed') && (
				<p className={style.recordingFailure} role="alert">
					{entry.error || 'Could not process this voice note.'}
				</p>
			)}
			{entry.status === 'ready' && !entry.summary && (
				<p className={style.wikiKind}>Analysis pending</p>
			)}
			{entry.summary && (
				<SummaryCard
					playback={playback}
					showPeriod={false}
					showTitle={false}
					summary={entry.summary}
					timeZone={entry.timeZone}
				/>
			)}
			{entry.status !== 'ready' && <JournalMap entries={[entry]} />}
		</article>
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

type JournalSelection = Partial<
	Record<'at' | 'year' | 'month' | 'week' | 'day' | 'entry', string>
>;
type AggregatePeriod = Exclude<JournalSummary['period'], 'entry' | 'journal'>;

interface JournalPeriodNode {
	readonly end: string;
	readonly id: string;
	readonly period: AggregatePeriod;
	readonly start: string;
	readonly summary?: JournalSummary;
	readonly title?: string;
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

function periodsFor(
	journal: Journal,
	period: AggregatePeriod
): JournalPeriodNode[] {
	if (journal.browse)
		return journal.browse.periods
			.filter(node => node.period === period)
			.map(node => ({
				...node,
				summary: journal.summaries.find(
					summary =>
						summary.period === period &&
						periodContains(node, periodMidpoint(summary))
				),
			}));
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
		if (journal.curation) continue;
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

function journalHref(route: JournalRoute, selection: JournalSelection = {}) {
	const pathname = `/journal/${route}`;
	const query = new URLSearchParams(
		Object.entries(selection).filter(
			(value): value is [string, string] => value[1] !== undefined
		)
	);
	return query.size > 0 ? `${pathname}?${query}` : pathname;
}

function periodMidpoint(period: Pick<JournalPeriodNode, 'start' | 'end'>) {
	return new Date(
		(Date.parse(period.start) + Date.parse(period.end)) / 2
	).toISOString();
}

function PeriodDisclosure({
	timeZone,
	curation,
	children,
	initiallyOpen,
	nextRoute,
	node,
	playback,
}: {
	readonly timeZone?: string;
	readonly curation: boolean;
	readonly children: readonly JournalPeriodNode[];
	readonly initiallyOpen: boolean;
	readonly nextRoute: JournalRoute;
	readonly node: JournalPeriodNode;
	readonly playback: JournalPlayback;
}) {
	const [open, setOpen] = useState(initiallyOpen);
	useEffect(() => {
		if (initiallyOpen) setOpen(true);
	}, [initiallyOpen]);

	return (
		<details
			className={style.periodDisclosure}
			data-journal-period-disclosure={node.period}
			onToggle={event => setOpen(event.currentTarget.open)}
			open={open}
		>
			<summary>
				<span className={style.periodDate}>
					<PeriodDate summary={node} timeZone={timeZone} />
				</span>
				<strong className={style.periodTitle}>
					{node.summary?.title ??
						node.title ??
						(curation
							? 'Browse recordings'
							: 'Summary in progress…')}
				</strong>
				<FontAwesomeIcon
					aria-hidden="true"
					className={style.periodChevron}
					icon={faChevronDown}
				/>
			</summary>
			<div className={style.periodDisclosureBody}>
				{node.summary && (
					<SummaryCard
						playback={playback}
						showPeriod={false}
						showTitle={false}
						summary={node.summary}
					/>
				)}
				{children.length > 0 && (
					<ol
						aria-label={`Browse ${nextRoute}s`}
						className={style.periodChildren}
					>
						{children.map(child => (
							<li key={child.id}>
								<Link
									data-journal-period-link={nextRoute}
									href={journalHref(nextRoute, {
										at: periodMidpoint(child),
									})}
								>
									<span className={style.periodChildDate}>
										<PeriodDate
											summary={child}
											timeZone={timeZone}
										/>
									</span>
									<strong>
										{child.summary?.title ??
											child.title ??
											(curation
												? 'Browse recordings'
												: 'Summary in progress…')}
									</strong>
									<FontAwesomeIcon
										aria-hidden="true"
										className={style.periodChildChevron}
										icon={faChevronDown}
									/>
								</Link>
							</li>
						))}
					</ol>
				)}
			</div>
		</details>
	);
}

function JournalDatePicker({
	journal,
	focus,
	route,
}: {
	readonly journal: Journal;
	readonly focus: string;
	readonly route?: JournalRoute;
}) {
	const [language] = useLocale();
	const timeZone = journal.browse?.timeZone ?? 'UTC';
	const selected = Temporal.Instant.from(focus).toZonedDateTimeISO(timeZone);
	const [date, setDate] = useState(selected.with({ day: 1 }));
	const [view, setView] = useState<'day' | 'month' | 'year'>(
		route === 'year' ? 'month' : 'day'
	);
	const heading = useRef<HTMLButtonElement>(null);
	const yearStart = Math.floor(date.year / 12) * 12;
	const monthName = date.toLocaleString(language, { month: 'long' });
	const firstDay = date.with({ day: 1 }).startOfDay();
	const monthAt = (
		date.year === selected.year && date.month === selected.month
			? selected
			: firstDay.with({ hour: 12 })
	)
		.toInstant()
		.toString();
	const selectedDay = selected.toPlainDate().toString();
	const changeView = (next: typeof view) => {
		setView(next);
		heading.current?.focus();
	};
	const step = (direction: number) =>
		setDate(value =>
			value.add(
				view === 'day'
					? { months: direction }
					: { years: direction * (view === 'year' ? 12 : 1) }
			)
		);
	const stepLabel =
		view === 'day' ? 'month' : view === 'month' ? 'year' : '12 years';
	return (
		<>
			<header className={style.calendarHeading}>
				<button
					type="button"
					aria-label={`Previous ${stepLabel}`}
					title={`Previous ${stepLabel}`}
					onClick={() => step(-1)}
				>
					‹
				</button>
				<button
					type="button"
					ref={heading}
					aria-label={
						view === 'month' ? 'Choose year' : 'Choose month'
					}
					title={view === 'month' ? 'Choose year' : 'Choose month'}
					onClick={() =>
						changeView(view === 'month' ? 'year' : 'month')
					}
				>
					{view === 'day'
						? `${monthName} ${date.year}`
						: view === 'month'
							? date.year
							: `${yearStart}–${yearStart + 11}`}
					<FontAwesomeIcon aria-hidden="true" icon={faChevronDown} />
				</button>
				<button
					type="button"
					aria-label={`Next ${stepLabel}`}
					title={`Next ${stepLabel}`}
					onClick={() => step(1)}
				>
					›
				</button>
			</header>
			{view === 'day' ? (
				<div
					className={style.calendarDays}
					role="group"
					aria-label={`${monthName} ${date.year}`}
				>
					{Array.from({ length: 7 }, (_, index) => (
						<span className={style.calendarWeekday} key={index}>
							{firstDay
								.add({ days: index + 1 - firstDay.dayOfWeek })
								.toLocaleString(language, {
									weekday: 'narrow',
								})}
						</span>
					))}
					{Array.from(
						{ length: firstDay.dayOfWeek - 1 },
						(_, index) => (
							<span key={`space-${index}`} />
						)
					)}
					{Array.from({ length: date.daysInMonth }, (_, index) => {
						const day = firstDay
							.add({ days: index })
							.with({ hour: 12 });
						return (
							<Link
								key={day.day}
								href={journalHref('day', {
									at: day.toInstant().toString(),
								})}
								aria-label={day.toLocaleString('en-GB', {
									day: 'numeric',
									month: 'long',
									year: 'numeric',
								})}
								aria-current={
									day.toPlainDate().toString() === selectedDay
										? 'date'
										: undefined
								}
							>
								{day.day}
							</Link>
						);
					})}
				</div>
			) : (
				<div
					className={style.calendarPeriods}
					role="group"
					aria-label={
						view === 'month'
							? `Months in ${date.year}`
							: 'Choose a year'
					}
				>
					{Array.from({ length: 12 }, (_, index) => {
						const value =
							view === 'month' ? index + 1 : yearStart + index;
						const period =
							view === 'month'
								? date.with({ month: value })
								: date.with({ year: value });
						const current =
							view === 'month'
								? value === selected.month &&
									date.year === selected.year
								: value === selected.year;
						return (
							<button
								key={value}
								type="button"
								aria-pressed={current}
								onClick={() => {
									setDate(period);
									changeView(
										view === 'month' ? 'day' : 'month'
									);
								}}
							>
								{view === 'month'
									? period.toLocaleString(language, {
											month: 'short',
										})
									: value}
							</button>
						);
					})}
				</div>
			)}
			<div className={style.calendarSummaries}>
				<Link
					aria-label={
						view === 'day' ? 'Month summary' : 'Year summary'
					}
					href={journalHref(view === 'day' ? 'month' : 'year', {
						at: monthAt,
					})}
				>
					{view === 'day' ? monthName : date.year} summary{' '}
					<span aria-hidden="true">↗</span>
				</Link>
				{view === 'day' && (
					<Link
						aria-label="Week summary"
						href={journalHref('week', {
							at: monthAt,
						})}
					>
						Week summary
					</Link>
				)}
			</div>
			<nav aria-label="Browse journal" className={style.calendarFooter}>
				<Link
					href={`/journal?${new URLSearchParams({ at: focus })}`}
					aria-current={route === undefined ? 'page' : undefined}
				>
					Overview
				</Link>
				<Link href="/journal?wiki=all">Wiki</Link>
			</nav>
		</>
	);
}

function JournalToolbar({
	journal,
	wiki = false,
	actions,
	focus,
	route,
}: {
	readonly journal?: Journal;
	readonly wiki?: boolean;
	readonly actions?: ReactNode;
	readonly focus: string;
	readonly route?: JournalRoute;
}) {
	return (
		<div className={style.journalToolbar} data-journal-toolbar>
			{journal ? (
				<CalendarNavigation
					journal={journal}
					focus={focus}
					route={route}
				/>
			) : (
				<Link href="/journal">Browse journal</Link>
			)}
			<Link
				className={style.wikiNavigation}
				href="/journal?wiki=all"
				aria-current={wiki ? 'page' : undefined}
			>
				Wiki
			</Link>
			{actions}
		</div>
	);
}

function PeriodList({
	deleteEntry,
	focus,
	journal,
	nextRoute,
	period,
	playback,
	updateEntryDate,
}: {
	readonly deleteEntry?: (entryID: string) => Promise<void>;
	readonly focus: string;
	readonly journal: Journal;
	readonly nextRoute?: JournalRoute;
	readonly period: AggregatePeriod;
	readonly playback: JournalPlayback;
	readonly updateEntryDate?: (
		entryID: string,
		recordedDate: string
	) => Promise<void>;
}) {
	const periods = periodsFor(journal, period);
	const node = periods.find(node => periodContains(node, focus));
	const children =
		nextRoute && node
			? childPeriodsFor(periodsFor(journal, nextRoute), node)
			: [];
	const entries = node
		? journal.entries.filter(
				entry =>
					entry.status === 'ready' &&
					periodContains(node, entry.recordedAt)
			)
		: [];
	if (!node) return <p className={style.empty}>No entries in this period.</p>;
	return (
		<div
			className={`${style.periodList} ${period === 'day' ? style.dayList : style.periodOverviewList}`}
			role="region"
			aria-label={`Journal ${period}`}
		>
			<section
				className={style.period}
				data-journal-period-start={node.start}
			>
				{nextRoute ? (
					<PeriodDisclosure
						timeZone={journal.browse?.timeZone}
						key={node.id}
						curation={journal.curation !== undefined}
						children={children}
						initiallyOpen
						nextRoute={nextRoute}
						node={node}
						playback={playback}
					/>
				) : (
					<>
						{node.summary && (
							<SummaryCard
								playback={playback}
								showPeriod={false}
								summary={node.summary}
							/>
						)}
					</>
				)}
				{period === 'day' && (
					<>
						{entries.length === 0 && (
							<p className={style.empty}>
								No recordings this day.
							</p>
						)}
						{entries.map(entry => (
							<EntryCard
								deleteEntry={deleteEntry}
								entry={entry}
								key={entry.id}
								playback={playback}
								updateEntryDate={updateEntryDate}
							/>
						))}
					</>
				)}
				<JournalMap
					entries={
						period === 'day'
							? entries
							: (journal.browse?.locations ?? [])
					}
				/>
			</section>
		</div>
	);
}

function CalendarNavigation({
	journal,
	focus,
	route,
}: {
	readonly journal: Journal;
	readonly focus: string;
	readonly route?: JournalRoute;
}) {
	const [language] = useLocale();
	const picker = useRef<HTMLDetailsElement>(null);
	const fitPicker = useCallback(() => {
		if (!picker.current?.open) return;
		const panel =
			picker.current.querySelector<HTMLDivElement>(':scope > div');
		if (!panel) return;
		panel.style.maxBlockSize = `${Math.max(44, window.innerHeight - panel.getBoundingClientRect().top - 16)}px`;
	}, []);
	useEffect(() => {
		const closeOutside = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				!picker.current?.contains(event.target)
			) {
				picker.current?.removeAttribute('open');
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !picker.current?.open) return;
			picker.current.removeAttribute('open');
			picker.current.querySelector('summary')?.focus();
		};
		window.addEventListener('resize', fitPicker);
		window.addEventListener('scroll', fitPicker, true);
		document.addEventListener('pointerdown', closeOutside);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			window.removeEventListener('resize', fitPicker);
			window.removeEventListener('scroll', fitPicker, true);
			document.removeEventListener('pointerdown', closeOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [fitPicker]);
	const browse = journal.browse;
	if (!browse) return null;
	return (
		<nav
			className={style.calendarNavigation}
			aria-label="Choose journal date"
		>
			{route &&
				(browse.previous ? (
					<Link
						aria-label={`Previous ${route}`}
						title={`Previous ${route}`}
						href={journalHref(route, { at: browse.previous })}
					>
						←
					</Link>
				) : (
					<span aria-disabled="true" aria-label={`Previous ${route}`}>
						←
					</span>
				))}
			<details
				ref={picker}
				onToggle={fitPicker}
				className={style.datePicker}
				key={`${route}-${focus}`}
			>
				<summary aria-label="Choose journal date">
					{!route && (
						<FontAwesomeIcon
							aria-hidden="true"
							icon={faCalendarDays}
						/>
					)}
					{route
						? Temporal.Instant.from(focus)
								.toZonedDateTimeISO(browse.timeZone)
								.toLocaleString(
									language,
									route === 'year'
										? { year: 'numeric' }
										: route === 'month'
											? { year: 'numeric', month: 'long' }
											: {
													year: 'numeric',
													month: 'short',
													day: 'numeric',
												}
								)
						: 'Calendar'}{' '}
					<FontAwesomeIcon aria-hidden="true" icon={faChevronDown} />
				</summary>
				<div
					className={style.dateChoices}
					onClick={event => {
						if (
							event.target instanceof Element &&
							event.target.closest('a')
						)
							picker.current?.removeAttribute('open');
					}}
				>
					<JournalDatePicker
						key={`${route}-${focus}`}
						journal={journal}
						focus={focus}
						route={route}
					/>
				</div>
			</details>
			{route &&
				(browse.next ? (
					<Link
						aria-label={`Next ${route}`}
						title={`Next ${route}`}
						href={journalHref(route, { at: browse.next })}
					>
						→
					</Link>
				) : (
					<span aria-disabled="true" aria-label={`Next ${route}`}>
						→
					</span>
				))}
		</nav>
	);
}

function RecentEntries({ journal }: { readonly journal: Journal }) {
	const [language] = useLocale();
	const entries = [...journal.entries]
		.filter(entry => entry.status === 'ready')
		.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
		.slice(0, 5);
	if (entries.length === 0) return null;
	return (
		<section
			aria-labelledby="recent-journal-entries"
			className={style.recent}
		>
			<header>
				<h2 id="recent-journal-entries">Recent entries</h2>
				<Link href={journalHref('day', { at: entries[0]?.recordedAt })}>
					Browse days
				</Link>
			</header>
			<ol>
				{entries.map(entry => {
					const date = journalEntryDate(entry);
					return (
						<li key={entry.id}>
							<Link
								href={
									journalHref('day', {
										at: entry.recordedAt,
										entry: entry.id,
									}) + `#entry-${entry.id}`
								}
							>
								<strong>
									{entry.title ??
										entry.summary?.title ??
										'Untitled entry'}
								</strong>
								<span className={style.recentMeta}>
									<time dateTime={entry.recordedAt}>
										{date.toLocaleString(language, {
											weekday: 'short',
											day: 'numeric',
											month: 'short',
											year: 'numeric',
										})}
									</time>
									<span aria-hidden="true">·</span>
									<LocalizedTime date={date} />
								</span>
								<FontAwesomeIcon
									className={style.recentChevron}
									aria-hidden="true"
									icon={faChevronDown}
								/>
							</Link>
						</li>
					);
				})}
			</ol>
		</section>
	);
}

function WikiHeader({
	index = false,
	curation,
}: {
	readonly index?: boolean;
	readonly curation?: JournalCurationStatus;
}) {
	return (
		<>
			<h2 className={style.wikiHeading}>
				{index ? 'Wiki' : <Link href="/journal?wiki=all">Wiki</Link>}
			</h2>
			{curation?.status === 'failed' && (
				<p role="status">
					The latest update could not finish. It will retry
					automatically.
				</p>
			)}
		</>
	);
}

function WikiArticle({ page }: { readonly page: JournalWikiPageView }) {
	const playback = useMemo<JournalCitationPlayback>(() => {
		const key = (entryID: string, segmentID: string) =>
			JSON.stringify([entryID, segmentID]);
		const sources = new Map(
			page.sources.map(source => [
				key(source.entryId, source.segmentId),
				source,
			])
		);
		const entries = new Map(
			page.sources.map(source => [source.entryId, source])
		);
		const quotes = new Map(
			page.blocks
				.flatMap(block => block.citations)
				.map(citation => [
					key(citation.entryId, citation.segmentId),
					citation.quote,
				])
		);
		return {
			hrefForSegment: (entryID, segmentID) => {
				const source = sources.get(key(entryID, segmentID));
				return journalPlaybackHref(
					entryID,
					(source?.startMs ?? 0) / 1000,
					journalHref('day', { at: source?.recordedAt })
				);
			},
			labelForSegment: (entryID, segmentID) =>
				mediaTimestamp(
					sources.get(key(entryID, segmentID))?.startMs ?? 0
				),
			quoteForSegment: (entryID, segmentID) =>
				quotes.get(key(entryID, segmentID)) ?? '',
			titleForEntry: entryID => {
				const source = entries.get(entryID);
				if (!source) return '';
				const date = Temporal.Instant.from(source.recordedAt)
					.toZonedDateTimeISO(source.timeZone)
					.toPlainDate()
					.toString();
				return source.title ? `${date}: ${source.title}` : date;
			},
			playSegment: () => false,
			playingEntryID: undefined,
			playingSegmentID: undefined,
		};
	}, [page]);
	return (
		<>
			<WikiHeader curation={page.curation} />
			<p className={style.wikiKind}>{page.kind}</p>
			<SummaryCard
				playback={playback}
				showPeriod={false}
				summary={{
					schemaVersion: 1,
					id: `wiki:${page.id}`,
					title: page.title,
					blocks: page.blocks,
					period: 'journal',
					start: '',
					end: '',
				}}
			/>
			{page.aliases.length > 0 && (
				<p>Also known as {page.aliases.join(', ')}</p>
			)}
		</>
	);
}

function JournalWikiPage({ pageID }: { readonly pageID: string }) {
	const [token] = useZemnMeAuth();
	const page = useGetJournalWikiPage(token, pageID);
	return page(
		value => <WikiArticle page={value} />,
		() => (
			<>
				<WikiHeader />
				<JournalPlaceholder label="Loading wiki page" />
			</>
		),
		() => (
			<>
				<WikiHeader />
				<p role="status">
					This page is unavailable or awaiting an update.
				</p>
			</>
		)
	);
}

function WikiIndex({
	index,
	query,
	setQuery,
}: {
	readonly index: JournalWikiIndex;
	readonly query: string;
	readonly setQuery: (query: string) => void;
}) {
	const pages = index.pages;
	const matches = pages.filter(page =>
		[page.title, ...page.aliases]
			.join(' ')
			.toLocaleLowerCase()
			.includes(query.toLocaleLowerCase())
	);
	return (
		<>
			<WikiHeader curation={index.curation} index />
			<input
				aria-label="Search wiki"
				className={style.wikiSearch}
				placeholder="Search"
				type="search"
				value={query}
				onChange={event => setQuery(event.currentTarget.value)}
			/>
			{matches.length > 0 ? (
				<ul className={style.wikiIndex}>
					{matches.map(page => (
						<li key={page.id}>
							<Link href={`/journal?wiki=${page.id}`}>
								<strong>{page.title}</strong>
								<span>{page.kind}</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p>{pages.length ? 'No matching pages.' : 'No pages yet.'}</p>
			)}
		</>
	);
}

function JournalWikiIndex({
	query,
	setQuery,
}: {
	readonly query: string;
	readonly setQuery: (query: string) => void;
}) {
	const [token] = useZemnMeAuth();
	const index = useGetJournalWikiIndex(token);
	return index(
		value => <WikiIndex index={value} query={query} setQuery={setQuery} />,
		() => (
			<>
				<WikiHeader index />
				<JournalPlaceholder label="Loading wiki" />
			</>
		),
		() => (
			<>
				<WikiHeader index />
				<p role="alert">Could not load the wiki.</p>
			</>
		)
	);
}

function JournalWiki({ pageID }: { readonly pageID: string }) {
	const [query, setQuery] = useState('');
	return (
		<section className={style.wiki} aria-label="Diary wiki">
			{pageID === 'all' ? (
				<JournalWikiIndex query={query} setQuery={setQuery} />
			) : (
				<JournalWikiPage pageID={pageID} />
			)}
		</section>
	);
}

function JournalBrowser({
	actions,
	localRecordings,
	localEntryIDs,
	deleteEntry,
	journal,
	route,
	updateEntryDate,
}: {
	readonly actions?: ReactNode;
	readonly deleteEntry?: (entryID: string) => Promise<void>;
	readonly journal: Journal;
	readonly localRecordings: ReactNode;
	readonly localEntryIDs: readonly (string | undefined)[];
	readonly route?: JournalRoute;
	readonly updateEntryDate?: (
		entryID: string,
		recordedDate: string
	) => Promise<void>;
}) {
	const renderTime = useJournalRenderTime();
	const [selection] = useSearchParams();
	const at = selection.get('at');
	const playback = useJournalPlayer();
	const pendingEntries = journal.entries.filter(
		entry =>
			['awaiting_upload', 'processing', 'failed'].includes(
				entry.status
			) && !localEntryIDs.includes(entry.id)
	);
	const legacyFocus = (['day', 'week', 'month', 'year'] as const)
		.filter(period => selection.has(period))
		.map(period =>
			periodsFor(journal, period).find(
				node => node.id === selection.get(period)
			)
		)
		.find(node => node !== undefined)?.start;
	const newestEntry = useMemo(
		() =>
			journal.entries
				.filter(entry => entry.status !== 'failed')
				.sort(
					(a, b) =>
						Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
				)[0],
		[journal.entries]
	);
	const focus =
		(at && Number.isFinite(Date.parse(at)) ? at : undefined) ??
		legacyFocus ??
		journal.browse?.focus ??
		newestEntry?.recordedAt ??
		new Date(renderTime).toISOString();

	if (route === undefined) {
		const readyEntries = journal.entries.filter(
			entry => entry.status === 'ready'
		);
		const summary = journal.curation
			? undefined
			: (journal.summaries.find(value => value.period === 'journal') ??
				(readyEntries.length === 1
					? readyEntries.at(0)?.summary
					: undefined));
		return (
			<div>
				<JournalToolbar
					journal={journal}
					actions={actions}
					focus={focus}
				/>
				{localRecordings}
				<PendingEntries entries={pendingEntries} playback={playback} />
				<RecentEntries journal={journal} />
				{summary ? (
					<SummaryCard
						playback={playback}
						showPeriod={false}
						summary={summary}
					/>
				) : !journal.curation && readyEntries.length > 1 ? (
					<JournalPlaceholder label="Preparing journal overview" />
				) : (
					readyEntries.length === 0 &&
					pendingEntries.length === 0 &&
					localEntryIDs.length === 0 && (
						<div className={style.empty}>
							<FontAwesomeIcon
								aria-hidden="true"
								icon={faBookOpen}
							/>
							<p>No entries yet</p>
						</div>
					)
				)}
				<JournalMap entries={readyEntries} />
			</div>
		);
	}

	const nextRoute: Partial<Record<JournalRoute, JournalRoute>> = {
		year: 'month',
		month: 'day',
		week: 'day',
	};
	return (
		<div>
			<JournalToolbar
				journal={journal}
				actions={actions}
				focus={focus}
				route={route}
			/>
			{localRecordings}
			<PendingEntries entries={pendingEntries} playback={playback} />
			<PeriodList
				deleteEntry={deleteEntry}
				focus={focus}
				journal={journal}
				nextRoute={nextRoute[route]}
				period={route}
				playback={playback}
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
								throw new Error(
									'Could not add sample entries.'
								);
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
					padding: '0.5em 0.8em',
				}}
				type="button"
			>
				{status === 'seeding'
					? 'Adding entries…'
					: 'Add sample entries'}
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

type JournalReaderContext = Omit<
	ComponentProps<typeof JournalBrowser>,
	'route'
>;

export default function JournalPageClient({
	route,
}: {
	readonly route?: JournalRoute;
}) {
	const props = useOutletContext<JournalReaderContext>();
	return <JournalBrowser {...props} route={route} />;
}

export function JournalReaderLayout() {
	const { pathname } = useLocation();
	const [playerHost, setPlayerHost] = useState<HTMLDivElement | null>(null);
	const renderTime = useJournalRenderTime();
	const [idToken, , promptForLoginFuture] = useZemnMeAuth();
	const scopes = useGetMeScopes(idToken);
	const [selection] = useSearchParams();
	const wiki = selection.get('wiki');
	const at = selection.get('at');
	const [hasLocalRecordings, setHasLocalRecordings] = useState(false);
	const browse = journalBrowseQuery(pathname, at);
	const route = browse.view === 'overview' ? undefined : browse.view;
	const journal = useGetJournal(idToken, wiki === null, browse);
	const uploads = useGetJournalUploads(idToken, hasLocalRecordings);
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
	const recorder = useRef<RecordingSession | undefined>(undefined);
	const [recordingBusy, setRecordingBusy] = useState(false);
	const [recordingElapsed, setRecordingElapsed] = useState(0);
	const [recording, setRecording] = useState(false);
	const [recordingStream, setRecordingStream] = useState<MediaStream>();
	const [recordingError, setRecordingError] = useState<string>();
	const [recordingLocationError, setRecordingLocationError] =
		useState<string>();
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
	const claims = useSessionClaims(idToken);
	const isLoggedIn = claims !== undefined;
	const owner = claims ? JSON.stringify([claims.iss, claims.sub]) : undefined;
	const currentOwner = useRef(owner);
	currentOwner.current = owner;
	const queue = useRecordingQueue({
		owner,
		canSync:
			hasWriteScope &&
			idToken(
				() => true,
				() => false,
				() => false
			),
		upload: createJournalEntry,
		entries: uploads(
			value => value.entries,
			() => [],
			() => []
		),
		readyEntryIDs: uploads(
			value =>
				value.entries
					.filter(entry => entry.status === 'ready')
					.map(entry => entry.id),
			() => [],
			() => []
		),
	});
	useEffect(() => {
		setHasLocalRecordings(queue.recordings.length > 0);
	}, [queue.recordings.length]);
	const keepRecording = queue.keep;
	const refreshRecordings = queue.refresh;
	useEffect(() => {
		currentOwner.current = owner;
		setRecordingLocationError(undefined);
		return () => {
			currentOwner.current = undefined;
			recorder.current?.stop();
		};
	}, [owner]);
	useEffect(() => {
		if (!recordingStream && queue.emergencyIDs.size === 0) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [recordingStream, queue.emergencyIDs.size]);
	const promptForLogin = promptForLoginFuture(
		value => value,
		() => undefined,
		() => undefined
	);
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
			if (!owner) throw new Error('Sign in before saving a voice note.');
			if (blob.size === 0) throw new Error('The audio file is empty.');
			const contentType = normalizedContentType(blob);
			const draft: LocalRecording = {
				id: crypto.randomUUID(),
				owner,
				parts: [blob],
				contentType,
				recordedAt: recordedAt.toISOString(),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				name: blob instanceof File ? blob.name : 'voice-note.webm',
				state: 'queued',
			};
			await keepRecording(draft);
		},
		[keepRecording, owner, resetSubmission]
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
		setRecordingLocationError(undefined);
		if (!owner) {
			setRecordingError('Sign in before recording a voice note.');
			return;
		}
		setRecordingBusy(true);
		let session: RecordingSession | undefined;
		try {
			session = await startLocalRecording(owner, {
				tick: setRecordingElapsed,
				locationError: message => {
					if (currentOwner.current === owner)
						setRecordingLocationError(message);
				},
				finished: (draft, durable, message) => {
					if (recorder.current === session) {
						recorder.current = undefined;
						setRecordingStream(undefined);
						setRecording(false);
						setRecordingBusy(false);
					}
					if (message) setRecordingError(message);
					if (draft) void keepRecording(draft, durable);
					else void refreshRecordings();
				},
			});
			if (currentOwner.current !== owner) {
				session.stop();
				return;
			}
			recorder.current = session;
			setRecordingStream(session.stream);
			setRecording(true);
			setRecordingBusy(false);
		} catch (error) {
			setRecordingBusy(false);
			setRecordingError(errorMessage(error));
		}
	};

	const endRecording = (disposition: 'discard' | 'submit') => {
		if (!recorder.current) return;
		setRecordingBusy(true);
		recorder.current.stop(disposition === 'discard');
	};

	const uploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = '';
		if (files.length === 0) return;
		void submitFiles(files).catch(error =>
			setRecordingError(errorMessage(error))
		);
	};
	const captureControls = hasWriteScope ? (
		<section
			aria-label="Create a journal entry"
			aria-busy={recordingBusy || queue.syncing !== undefined}
			className={style.recorder}
			data-recording={recordingStream ? '' : undefined}
			data-notice={
				recordingError || recordingLocationError ? '' : undefined
			}
			data-uploading={queue.syncing ? '' : undefined}
		>
			{!recordingStream && (
				<label className={style.uploadButton} title="Import voice memo">
					<FontAwesomeIcon icon={faUpload} />
					{queue.syncing && (
						<span className={style.uploadProgress}>
							{queue.uploadProgress === undefined ? (
								<JournalStatus label="Preparing upload" />
							) : (
								<JournalProgress
									label="Uploading voice note"
									progress={queue.uploadProgress}
								/>
							)}
						</span>
					)}
					<input
						accept="audio/*,.m4a"
						aria-label="Import voice memo"
						disabled={recordingBusy}
						multiple
						onChange={uploadFiles}
						type="file"
					/>
				</label>
			)}
			<button
				aria-label={
					recordingBusy
						? recording
							? 'Saving voice note'
							: 'Starting microphone'
						: recording
							? 'Stop and upload'
							: 'Record a note'
				}
				className={`${style.recordButton} ${recording ? style.submitButton : ''}`}
				disabled={recordingBusy}
				onClick={
					recording ? () => endRecording('submit') : startRecording
				}
				title={recording ? 'Stop and upload' : 'Record a note'}
				type="button"
			>
				<FontAwesomeIcon
					aria-hidden="true"
					className={recordingBusy ? style.spinning : undefined}
					icon={
						recordingBusy
							? faSpinner
							: recording
								? faUpload
								: faMicrophone
					}
				/>
			</button>
			{recordingStream && (
				<>
					<RecordingWaveform stream={recordingStream} />
					<div className={style.recordingTime}>
						<span role="timer" aria-label="Recording duration">
							{mediaTimestamp(recordingElapsed)}
						</span>
					</div>
					<button
						aria-label="Cancel recording"
						disabled={recordingBusy}
						className={style.cancelButton}
						onClick={() => endRecording('discard')}
						type="button"
					>
						<FontAwesomeIcon aria-hidden="true" icon={faTrashCan} />
					</button>
				</>
			)}
			{(recordingError || recordingLocationError) && (
				<p className={style.recordingNotice} role="status">
					{recordingError || recordingLocationError}
				</p>
			)}
		</section>
	) : undefined;

	return (
		<main
			className={`${style.page} ${draggingFile ? style.dropTarget : ''}`}
			data-journal-drop-active={draggingFile || undefined}
			data-journal-page=""
		>
			{draggingFile && (
				<div className={style.dropOverlay} role="status">
					<FontAwesomeIcon icon={faUpload} />
					Drop voice memo
				</div>
			)}
			<header className={style.hero}>
				<h1>Journal</h1>
				<div ref={setPlayerHost} />
			</header>
			{!isLoggedIn ? (
				<button
					aria-label="Authenticate with OIDC"
					disabled={promptForLogin === undefined}
					onClick={() => void promptForLogin?.()}
					type="button"
				>
					Sign in
				</button>
			) : !hasReadScope ? (
				<p className={style.notice}>
					<FontAwesomeIcon icon={faTriangleExclamation} />
					This journal is restricted to its owner.
				</p>
			) : (
				<JournalPlayerProvider
					portalTarget={playerHost}
					key={owner}
					journal={
						wiki === null
							? journal(
									value => value,
									() => undefined,
									() => undefined
								)
							: undefined
					}
				>
					{isDevelopment && <DevelopmentJournalTools />}
					{wiki !== null ? (
						<div>
							<JournalToolbar
								actions={captureControls}
								focus={at ?? ''}
								route={route}
								wiki
							/>
							<LocalRecordings
								queue={queue}
								activeID={recorder.current?.id}
							/>
							<JournalWiki pageID={wiki} />
						</div>
					) : (
						journal(
							value => (
								<Outlet
									context={
										{
											localRecordings: (
												<LocalRecordings
													queue={queue}
													activeID={
														recorder.current?.id
													}
												/>
											),
											localEntryIDs: queue.recordings.map(
												draft => draft.remoteEntryID
											),
											actions: captureControls,
											deleteEntry: hasWriteScope
												? deleteJournalEntry
												: undefined,
											journal: value,
											updateEntryDate: hasWriteScope
												? updateJournalEntryDate
												: undefined,
										} satisfies JournalReaderContext
									}
								/>
							),
							() => (
								<>
									<JournalToolbar
										route={route}
										actions={captureControls}
										focus={new Date(
											renderTime
										).toISOString()}
									/>
									<LocalRecordings
										queue={queue}
										activeID={recorder.current?.id}
									/>
									<JournalPlaceholder label="Loading journal" />
								</>
							),
							error => (
								<>
									<JournalToolbar
										route={route}
										actions={captureControls}
										focus={new Date(
											renderTime
										).toISOString()}
									/>
									<LocalRecordings
										queue={queue}
										activeID={recorder.current?.id}
									/>
									<p className={style.notice}>
										{errorMessage(error)}
									</p>
								</>
							)
						)
					)}
					<JournalMCPSetup />
				</JournalPlayerProvider>
			)}
		</main>
	);
}
