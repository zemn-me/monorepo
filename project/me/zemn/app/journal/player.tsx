import { faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { parseAsFloat, parseAsString, useQueryStates } from 'nuqs';
import {
	createContext,
	memo,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { Temporal } from 'temporal-polyfill';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import { Waveform } from '#root/project/me/zemn/app/journal/waveform.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { useFetchClient } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

type Journal = components['schemas']['Journal'];
type JournalEntry = components['schemas']['JournalEntry'];
type JournalTranscriptSegment = JournalEntry['transcript'][number];
const transcriptParagraphPauseMs = 3_000;

function citationID(entryID: string, segmentID: string) {
	return `transcript-${entryID}-${segmentID}`;
}

function roundedMediaTime(time: number): number {
	return Math.max(0, Math.round(time * 10) / 10);
}

export function journalPlaybackHref(
	entryID: string,
	time: number,
	basePath: string
): string {
	const separator = basePath.includes('?') ? '&' : '?';
	return `${basePath}${separator}${new URLSearchParams({
		entry: entryID,
		t: String(roundedMediaTime(time)),
	})}`;
}

export function journalEntryHref(
	entry: JournalEntry,
	seconds?: number
): string {
	const query = new URLSearchParams({
		at: entry.recordedAt,
		entry: entry.id,
	});
	if (seconds !== undefined)
		query.set('t', String(roundedMediaTime(seconds)));
	return `/journal/day?${query}#entry-${entry.id}`;
}

export function mediaTimestamp(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
		2,
		'0'
	)}:${String(seconds).padStart(2, '0')}`;
}

export function followsLinkNormally(event: ReactMouseEvent<HTMLAnchorElement>) {
	return (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	);
}

export interface JournalCitationPlayback {
	readonly playingEntryID?: string;
	readonly playingSegmentID?: string;
	hrefForSegment(entryID: string, segmentID: string): string;
	labelForSegment(entryID: string, segmentID: string): string;
	quoteForSegment(entryID: string, segmentID: string): string;
	titleForEntry(entryID: string): string;
	playSegment(entryID: string, segmentID: string): boolean;
}

export interface JournalPlayback extends JournalCitationPlayback {
	playFromStart(entry: JournalEntry): void;
	toggle(entry: JournalEntry): void;
	removeEntry(entryID: string): void;
}

const JournalPlayerContext = createContext<JournalPlayback | null>(null);
export function useJournalPlayer() {
	const player = useContext(JournalPlayerContext);
	if (!player) throw new Error('Journal player requires the journal reader');
	return player;
}

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
	readonly playback: JournalCitationPlayback;
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
		const observer = new ResizeObserver(() => {
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
		});
		observer.observe(container);
		return () => observer.disconnect();
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
	playback: JournalCitationPlayback
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

const playbackQuery = { entry: parseAsString, t: parseAsFloat };

export function JournalPlayerProvider({
	portalTarget,
	journal,
	children,
}: {
	readonly portalTarget: HTMLDivElement | null;
	readonly journal?: Journal;
	readonly children: ReactNode;
}) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [entry, setEntry] = useState<JournalEntry>();
	const selected = useRef<JournalEntry | undefined>(undefined);
	const [source, setSource] = useState('');
	const [playing, setPlaying] = useState(false);
	const [segmentID, setSegmentID] = useState<string>();
	const [failure, setFailure] = useState(false);
	const pendingTime = useRef<number | undefined>(undefined);
	const wantsPlay = useRef(false);
	const renewal = useRef<AbortController | undefined>(undefined);
	const renewed = useRef(false);
	const stallTimer = useRef<number | undefined>(undefined);
	const byID = useMemo(() => {
		const entries = new Map(
			journal?.entries.map(value => [value.id, value])
		);
		for (const source of journal?.browse?.sources ?? []) {
			// Overview rows omit playback content. A cited excerpt supplies its
			// timestamp and quote until the full recording's day is opened.
			if (!entries.get(source.id)?.audioUrl)
				entries.set(source.id, source);
		}
		return entries;
	}, [journal]);
	const latestEntries = useRef(byID);
	latestEntries.current = byID;
	const location = useLocation();
	const [identity] = useZemnMeAuth();
	const api = useFetchClient(
		identity(
			value => value,
			() => undefined,
			() => undefined
		)
	);
	const [, setCursor] = useQueryStates(playbackQuery, {
		history: 'replace',
		shallow: true,
	});
	const cursor = useRef<{ entry: string; t: number } | undefined>(undefined);
	const clearTimer = useCallback(
		() => window.clearTimeout(stallTimer.current),
		[]
	);
	useEffect(
		() => () => {
			clearTimer();
			renewal.current?.abort();
		},
		[clearTimer]
	);

	const writeCursor = useCallback(
		(id: string, seconds: number, history: 'push' | 'replace') => {
			// Listening can continue on another day or in the wiki. Its URL still
			// describes the page being read.
			if (!latestEntries.current.get(id)?.audioUrl) return;
			const next = { entry: id, t: roundedMediaTime(seconds) };
			if (cursor.current?.entry === id && cursor.current.t === next.t)
				return;
			cursor.current = next;
			void setCursor(next, { history });
		},
		[setCursor]
	);

	const startAudio = useCallback((audio: HTMLAudioElement) => {
		const requestedSource = audio.src;
		void audio.play().catch((error: Error) => {
			if (
				audio.src !== requestedSource ||
				error.name === 'AbortError' ||
				audio.error
			)
				return;
			wantsPlay.current = false;
			setPlaying(false);
			// Direct timestamp links can require a user gesture to start audio.
			setFailure(error.name !== 'NotAllowedError');
		});
	}, []);

	const loadSource = useCallback(
		(audio: HTMLAudioElement, url: string, seconds: number) => {
			pendingTime.current = seconds;
			audio.src = url;
			setSource(url);
			audio.load();
			if (wantsPlay.current) startAudio(audio);
		},
		[startAudio]
	);

	const recover = useCallback(async () => {
		const track = selected.current;
		const audio = audioRef.current;
		if (!track || !audio || renewal.current) return;
		clearTimer();
		if (renewed.current) {
			setFailure(true);
			wantsPlay.current = false;
			setPlaying(false);
			return;
		}
		const controller = new AbortController();
		renewal.current = controller;
		renewed.current = true;
		try {
			const response = await api.GET('/journal', {
				signal: controller.signal,
				params: { query: { view: 'day', at: track.recordedAt } },
			});
			if (controller.signal.aborted) return;
			const fresh = response.data?.entries.find(
				value => value.id === track.id
			);
			if (!fresh?.audioUrl) throw new Error('Recording unavailable');
			selected.current = fresh;
			setEntry(fresh);
			loadSource(
				audio,
				fresh.audioUrl,
				pendingTime.current ?? audio.currentTime
			);
		} catch {
			if (!controller.signal.aborted) {
				setFailure(true);
				wantsPlay.current = false;
				setPlaying(false);
			}
		} finally {
			if (renewal.current === controller) renewal.current = undefined;
		}
	}, [api, clearTimer, loadSource]);

	const seek = useCallback((seconds: number) => {
		const audio = audioRef.current;
		if (!audio || !Number.isFinite(seconds)) return;
		const target = Math.max(
			0,
			Number.isFinite(audio.duration)
				? Math.min(seconds, audio.duration)
				: seconds
		);
		if (audio.readyState === HTMLMediaElement.HAVE_NOTHING)
			pendingTime.current = target;
		else {
			pendingTime.current = undefined;
			audio.currentTime = target;
		}
	}, []);

	const select = useCallback(
		(track: JournalEntry, seconds: number, updateURL: boolean) => {
			const audio = audioRef.current;
			if (!audio || !track.audioUrl) return;
			clearTimer();
			setFailure(false);
			wantsPlay.current = true;
			if (updateURL) writeCursor(track.id, seconds, 'push');
			if (track.id === selected.current?.id) {
				seek(seconds);
				if (audio.error || (renewed.current && audio.paused)) {
					renewed.current = false;
					void recover();
				} else {
					startAudio(audio);
				}
				return;
			}
			renewal.current?.abort();
			renewal.current = undefined;
			renewed.current = false;
			selected.current = track;
			setEntry(track);
			setPlaying(false);
			setSegmentID(undefined);
			loadSource(audio, track.audioUrl, seconds);
		},
		[clearTimer, loadSource, recover, seek, startAudio, writeCursor]
	);

	const toggle = useCallback(
		(track: JournalEntry) => {
			const audio = audioRef.current;
			if (!audio) return;
			if (selected.current?.id === track.id && wantsPlay.current) {
				wantsPlay.current = false;
				audio.pause();
				return;
			}
			select(
				track,
				selected.current?.id === track.id && !audio.ended
					? (pendingTime.current ?? audio.currentTime)
					: 0,
				true
			);
		},
		[select]
	);

	const dismiss = useCallback(
		(id: string) => {
			if (selected.current?.id !== id) return;
			clearTimer();
			renewal.current?.abort();
			renewal.current = undefined;
			wantsPlay.current = false;
			selected.current = undefined;
			pendingTime.current = undefined;
			setEntry(undefined);
			setPlaying(false);
			setSegmentID(undefined);
			setFailure(false);
			const audio = audioRef.current;
			if (audio) {
				audio.pause();
				audio.removeAttribute('src');
				audio.load();
			}
			if (cursor.current?.entry === id) {
				cursor.current = undefined;
				void setCursor(
					{ entry: null, t: null },
					{ history: 'replace' }
				);
			}
		},
		[clearTimer, setCursor]
	);

	const applyURL = useCallback(
		(search: string) => {
			const params = new URLSearchParams(search);
			const id = params.get('entry');
			const t = params.get('t');
			if (!id || t === null || !Number.isFinite(Number(t))) {
				cursor.current = undefined;
				return;
			}
			const track = latestEntries.current.get(id);
			if (!track?.audioUrl) return;
			const seconds = Number(t);
			if (
				selected.current?.id === id &&
				cursor.current?.entry === id &&
				cursor.current.t === seconds
			)
				return;
			cursor.current = { entry: id, t: seconds };
			select(track, seconds, false);
		},
		[select]
	);
	const applyURLRef = useRef(applyURL);
	applyURLRef.current = applyURL;
	const available = !!byID.get(
		new URLSearchParams(location.search).get('entry') ?? ''
	)?.audioUrl;
	useEffect(() => {
		applyURLRef.current(window.location.search);
	}, [location.key, available]);
	useEffect(() => {
		const onPop = () => applyURLRef.current(window.location.search);
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const playback = useMemo<JournalPlayback>(() => {
		const find = (id: string) => (entry?.id === id ? entry : byID.get(id));
		const segment = (id: string, sid: string) =>
			find(id)?.transcript.find(part => part.id === sid);
		return {
			playFromStart: track => select(track, 0, true),
			toggle,
			removeEntry: dismiss,
			playingEntryID: playing ? entry?.id : undefined,
			playingSegmentID: playing ? segmentID : undefined,
			hrefForSegment: (id, sid) => {
				const at = find(id)?.recordedAt;
				return journalPlaybackHref(
					id,
					(segment(id, sid)?.startMs ?? 0) / 1000,
					at
						? '/journal/day?' + new URLSearchParams({ at })
						: '/journal'
				);
			},
			labelForSegment: (id, sid) =>
				mediaTimestamp(segment(id, sid)?.startMs ?? 0),
			quoteForSegment: (id, sid) => segment(id, sid)?.text ?? '',
			titleForEntry: id => {
				const track = find(id);
				if (!track) return '';
				const date = Temporal.Instant.from(track.recordedAt)
					.toZonedDateTimeISO(track.timeZone)
					.toPlainDate()
					.toString();
				return track.summary ? `${date}: ${track.summary.title}` : date;
			},
			playSegment: (id, sid) => {
				const track = find(id);
				const part = segment(id, sid);
				if (!track?.audioUrl || !part) return false;
				select(track, part.startMs / 1000, true);
				return true;
			},
		};
	}, [byID, dismiss, entry, playing, segmentID, select, toggle]);

	return (
		<JournalPlayerContext.Provider value={playback}>
			<audio
				hidden
				ref={audioRef}
				data-entry-id={entry?.id}
				onLoadedMetadata={() => {
					if (pendingTime.current !== undefined)
						seek(pendingTime.current);
				}}
				onTimeUpdate={event => {
					const audio = event.currentTarget;
					const track = selected.current;
					if (!track || audio.paused) return;
					const ms = audio.currentTime * 1000;
					const current = track.transcript.find(
						part => part.startMs <= ms && ms < part.endMs
					);
					setSegmentID(current?.id);
					if (current && cursor.current?.entry === track.id)
						writeCursor(
							track.id,
							current.startMs / 1000,
							'replace'
						);
				}}
				onPlay={() => {
					if (wantsPlay.current) setPlaying(true);
				}}
				onPlaying={() => {
					clearTimer();
					renewed.current = false;
					setFailure(false);
				}}
				onPause={event => {
					if (!event.currentTarget.paused) return;
					setPlaying(false);
					if (
						!renewal.current &&
						!event.currentTarget.error &&
						pendingTime.current === undefined
					)
						wantsPlay.current = false;
					if (
						!wantsPlay.current &&
						selected.current &&
						cursor.current?.entry === selected.current.id
					) {
						writeCursor(
							selected.current.id,
							event.currentTarget.currentTime,
							'replace'
						);
					}
				}}
				onEnded={() => {
					clearTimer();
					wantsPlay.current = false;
					setPlaying(false);
				}}
				onError={() => {
					if (selected.current) void recover();
				}}
				onStalled={() => {
					if (wantsPlay.current) void recover();
				}}
				onWaiting={() => {
					clearTimer();
					stallTimer.current = window.setTimeout(() => {
						const audio = audioRef.current;
						if (
							audio &&
							wantsPlay.current &&
							audio.currentTime > 0 &&
							audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
						)
							void recover();
					}, 1500);
				}}
			/>
			{portalTarget &&
				entry &&
				createPortal(
					<section
						className={style.player}
						aria-label="Journal player"
					>
						<div className={style.playerHeader}>
							<button
								className={style.playerToggle}
								aria-label={
									playing
										? 'Pause recording'
										: 'Play recording'
								}
								title={
									playing
										? 'Pause recording'
										: 'Play recording'
								}
								onClick={() => toggle(entry)}
								type="button"
							>
								<FontAwesomeIcon
									icon={playing ? faPause : faPlay}
								/>
							</button>
							<strong>
								<Link
									className={style.recordingTitle}
									href={journalEntryHref(entry)}
									styleless
									title="Go to journal entry"
								>
									{entry.title ??
										entry.summary?.title ??
										'Voice note'}
								</Link>
							</strong>
							<button
								className={style.playerClose}
								aria-label="Close player"
								title="Close player"
								onClick={() => dismiss(entry.id)}
								type="button"
							>
								<FontAwesomeIcon icon={faXmark} />
							</button>
						</div>
						{audioRef.current && (
							<Waveform
								key={`waveform-${entry.id}`}
								audio={audioRef.current}
								source={source}
								durationMs={entry.durationMs}
								onSeek={seconds => {
									seek(seconds);
									writeCursor(entry.id, seconds, 'replace');
								}}
							/>
						)}
						{failure && (
							<p role="alert">
								Couldn’t load this recording. Press play to
								retry.
							</p>
						)}
						{entry.transcript.length > 0 && (
							<Transcript
								key={`transcript-${entry.id}`}
								entry={entry}
								playback={playback}
							/>
						)}
					</section>,
					portalTarget
				)}
			{children}
		</JournalPlayerContext.Provider>
	);
}
