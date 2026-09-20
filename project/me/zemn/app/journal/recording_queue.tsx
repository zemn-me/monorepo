'use client';

import {
	faArrowRotateRight,
	faChevronDown,
	faDownload,
	faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState } from 'react';

import { maxUploadBytes } from '#root/project/me/zemn/app/journal/recording.js';
import {
	getRecording,
	type LocalRecording,
	listRecordings,
	recordingBlob,
	recordingLock,
	removeRecording,
	saveRecording,
} from '#root/project/me/zemn/app/journal/recording_store.js';
import { JournalStatus } from '#root/project/me/zemn/app/journal/status.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import type { JournalAudioUpload } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import {
	Date as LocalizedDate,
	Time as LocalizedTime,
} from '#root/ts/react/lang/date.js';

interface QueueOptions {
	readonly owner: string | undefined;
	readonly canSync: boolean;
	readonly upload: (
		audio: JournalAudioUpload
	) => Promise<{ readonly id: string }>;
	readonly readyEntryIDs: readonly string[];
}

export function useRecordingQueue(options: QueueOptions) {
	const current = useRef(options);
	current.current = options;
	const [recordings, setRecordings] = useState<LocalRecording[]>([]);
	const [memory, setMemory] = useState<LocalRecording[]>([]);
	const [syncing, setSyncing] = useState<string>();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [storageError, setStorageError] = useState<string>();
	const owner = options.owner;

	const refresh = useCallback(async () => {
		if (!owner) return;
		try {
			const saved = await listRecordings(owner);
			if (current.current.owner === owner) {
				setRecordings(saved);
				setStorageError(undefined);
			}
		} catch {
			if (current.current.owner === owner)
				setStorageError(
					'Could not open saved recordings. Free device storage and reload this page.'
				);
		}
	}, [owner]);

	const sync = useCallback(async () => {
		if (!owner || !current.current.canSync || !navigator.onLine) return;
		try {
			await navigator.locks.request(
				`journal-sync:${owner}`,
				{ ifAvailable: true },
				async lock => {
					if (!lock) return;
					for (const draft of await listRecordings(owner)) {
						if (
							current.current.owner !== owner ||
							!current.current.canSync
						)
							break;
						if (
							draft.remoteEntryID &&
							current.current.readyEntryIDs.includes(
								draft.remoteEntryID
							)
						) {
							await removeRecording(owner, draft.id);
							continue;
						}
						if (draft.state !== 'queued') continue;
						const file = recordingBlob(draft);
						if (file.size === 0 || file.size > maxUploadBytes)
							continue;
						setSyncing(draft.id);
						try {
							const entry = await current.current.upload({
								file,
								contentType: draft.contentType,
								recordedAt: draft.recordedAt,
								location: draft.location,
								timeZone: draft.timeZone,
							});
							// Keep the local audio until transcription is confirmed ready.
							await saveRecording({
								...draft,
								state: 'uploaded',
								remoteEntryID: entry.id,
								uploadedAt: Date.now(),
							});
							setErrors(previous => {
								const next = { ...previous };
								delete next[draft.id];
								return next;
							});
						} catch {
							setErrors(previous => ({
								...previous,
								[draft.id]:
									'Sync failed. Will retry automatically.',
							}));
							break;
						} finally {
							setSyncing(undefined);
						}
					}
				}
			);
		} catch {
			if (current.current.owner === owner)
				setStorageError(
					'Could not update saved recordings. Download a backup before leaving this page.'
				);
		}
		await refresh();
	}, [owner, refresh]);

	useEffect(() => {
		setRecordings([]);
		setErrors({});
		setSyncing(undefined);
		void refresh().then(sync);
		const retry = () => {
			void sync();
		};
		const timer = window.setInterval(retry, 15_000);
		window.addEventListener('online', retry);
		window.addEventListener('focus', retry);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener('online', retry);
			window.removeEventListener('focus', retry);
		};
	}, [refresh, sync, options.canSync]);

	const keep = useCallback(
		async (draft: LocalRecording, durable = false) => {
			try {
				if (!durable) await saveRecording(draft);
				setMemory(previous =>
					previous.filter(item => item.id !== draft.id)
				);
				await refresh();
				void sync();
			} catch {
				setMemory(previous => [
					...previous.filter(item => item.id !== draft.id),
					draft,
				]);
				setStorageError(
					'Could not save this recording on your device. Download it before leaving this page.'
				);
			}
		},
		[refresh, sync]
	);

	const retry = useCallback(
		async (draft: LocalRecording) => {
			await navigator.locks.request(
				recordingLock(draft.owner),
				{ ifAvailable: true },
				async recording => {
					if (!recording) return;
					await navigator.locks.request(
						`journal-sync:${draft.owner}`,
						{ ifAvailable: true },
						async lock => {
							if (!lock || current.current.owner !== draft.owner)
								return;
							const saved = memory.some(
								item => item.id === draft.id
							)
								? draft
								: ((await getRecording(
										draft.owner,
										draft.id
									)) ?? draft);
							await keep({
								...saved,
								state: 'queued',
								remoteEntryID: undefined,
								uploadedAt: undefined,
							});
						}
					);
				}
			);
			await sync();
		},
		[keep, memory, sync]
	);

	const discard = useCallback(
		async (draft: LocalRecording) => {
			await navigator.locks.request(
				recordingLock(draft.owner),
				{ ifAvailable: true },
				async recording => {
					if (!recording) return;
					await navigator.locks.request(
						`journal-sync:${draft.owner}`,
						{ ifAvailable: true },
						async lock => {
							if (!lock || current.current.owner !== draft.owner)
								return;
							await removeRecording(draft.owner, draft.id);
							setMemory(previous =>
								previous.filter(item => item.id !== draft.id)
							);
						}
					);
				}
			);
			await refresh();
		},
		[refresh]
	);

	const emergencyIDs = new Set(memory.map(item => item.id));
	return {
		recordings: [
			...recordings.filter(item => !emergencyIDs.has(item.id)),
			...memory,
		].filter(item => item.owner === owner),
		emergencyIDs,
		syncing,
		errors,
		storageError,
		keep,
		retry,
		discard,
		refresh,
	};
}

function LocalRecordingRow({
	draft,
	queue,
}: {
	readonly draft: LocalRecording;
	readonly queue: ReturnType<typeof useRecordingQueue>;
}) {
	const [url, setURL] = useState<string>();
	const [actionError, setActionError] = useState<string>();
	const file = recordingBlob(draft);
	useEffect(() => {
		const url = URL.createObjectURL(recordingBlob(draft));
		setURL(url);
		return () => URL.revokeObjectURL(url);
	}, [draft]);
	const tooLarge = file.size > maxUploadBytes;
	const uploading = queue.syncing === draft.id;
	const emergency = queue.emergencyIDs.has(draft.id);
	const canRetry =
		!uploading &&
		(!draft.uploadedAt || Date.now() - draft.uploadedAt > 120_000);
	const status =
		emergency || tooLarge || queue.errors[draft.id]
			? 'error'
			: uploading || draft.state === 'uploaded'
				? 'busy'
				: draft.state === 'recording'
					? 'interrupted'
					: 'queued';
	const label = emergency
		? 'Recording not saved'
		: tooLarge
			? 'Recording too large'
			: uploading
				? 'Syncing voice note'
				: draft.state === 'uploaded'
					? 'Transcribing voice note'
					: draft.state === 'recording'
						? 'Interrupted recording'
						: (queue.errors[draft.id] ?? 'Waiting to sync');
	return (
		<li>
			<details
				className={style.localRecording}
				open={emergency || tooLarge || undefined}
			>
				<summary title={label}>
					<div className={style.localRecordingHeading}>
						<span>
							{draft.name === 'voice-note.webm' ||
							/^voice-note-\d{4}-\d{2}-\d{2}T/.test(draft.name)
								? 'Voice note'
								: draft.name}
						</span>
						<small>
							<LocalizedDate date={new Date(draft.recordedAt)} />{' '}
							·{' '}
							<LocalizedTime date={new Date(draft.recordedAt)} />
						</small>
					</div>
					<JournalStatus label={label} state={status} />
					<FontAwesomeIcon
						aria-hidden="true"
						className={style.entryChevron}
						icon={faChevronDown}
					/>
				</summary>
				{emergency && (
					<p role="alert">
						Download this recording before leaving; it couldn’t be
						saved.
					</p>
				)}
				{tooLarge && (
					<p role="alert">
						Audio exceeds 256 MiB. Download and split it to sync.
					</p>
				)}
				<audio
					aria-label="Preview local recording"
					className={style.audio}
					controls
					preload="none"
					src={url}
				/>
				<div className={style.localRecordingActions}>
					<small>{(file.size / 1_000_000).toFixed(1)} MB</small>
					<a
						aria-label="Download audio"
						download={draft.name}
						href={url}
						title="Download audio"
					>
						<FontAwesomeIcon aria-hidden="true" icon={faDownload} />
					</a>
					{!tooLarge && file.size > 0 && (
						<button
							aria-label={
								draft.state === 'recording'
									? 'Sync saved audio'
									: 'Retry sync'
							}
							disabled={!canRetry}
							onClick={() => {
								void queue
									.retry(draft)
									.catch(() =>
										setActionError(
											'Could not retry. Your local recording has been kept.'
										)
									);
							}}
							title="Retry sync"
							type="button"
						>
							<FontAwesomeIcon
								aria-hidden="true"
								icon={faArrowRotateRight}
							/>
						</button>
					)}
					<details className={style.removeRecording}>
						<summary
							aria-label="Remove local copy"
							title="Remove local copy"
						>
							<FontAwesomeIcon
								aria-hidden="true"
								icon={faTrashCan}
							/>
						</summary>
						<div>
							<p>
								Delete this device’s copy? Unsynced audio will
								be lost.
							</p>
							<button
								disabled={uploading}
								onClick={() => {
									void queue
										.discard(draft)
										.catch(() =>
											setActionError(
												'Could not remove the local recording.'
											)
										);
								}}
								type="button"
							>
								Delete local recording
							</button>
						</div>
					</details>
				</div>
				{actionError && <p role="alert">{actionError}</p>}
			</details>
		</li>
	);
}

export function LocalRecordings({
	queue,
	activeID,
}: {
	readonly queue: ReturnType<typeof useRecordingQueue>;
	readonly activeID?: string;
}) {
	const recordings = queue.recordings.filter(item => item.id !== activeID);
	return (
		<>
			{queue.storageError && (
				<p className={style.notice} role="alert">
					{queue.storageError}
				</p>
			)}
			{recordings.length > 0 && (
				<section
					aria-label="Local recordings"
					className={style.localRecordings}
				>
					<ul>
						{recordings.map(draft => (
							<LocalRecordingRow
								draft={draft}
								key={draft.id}
								queue={queue}
							/>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
