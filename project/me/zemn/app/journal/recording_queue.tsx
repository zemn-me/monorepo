'use client';

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
									'Waiting to sync. Your recording is saved; another attempt will run automatically.',
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
	return (
		<li>
			<p>
				<LocalizedDate date={new Date(draft.recordedAt)} /> ·{' '}
				<LocalizedTime date={new Date(draft.recordedAt)} /> ·{' '}
				{(file.size / 1_000_000).toFixed(1)} MB
			</p>
			<p role="status">
				{emergency
					? 'Not saved on this device — download before leaving.'
					: tooLarge
						? 'This file exceeds the 256 MiB upload limit. Download a backup and split it into smaller recordings.'
						: uploading
							? 'Syncing voice note…'
							: draft.state === 'recording'
								? 'Interrupted recording — the audio saved so far is available to download or sync.'
								: draft.state === 'uploaded'
									? 'Uploaded — keeping a local copy until transcription is ready.'
									: (queue.errors[draft.id] ??
										'Waiting to sync voice note — saved on this device.')}
			</p>
			<div className={style.localRecordingActions}>
				<a download={draft.name} href={url}>
					Download audio
				</a>
				{!tooLarge && file.size > 0 && (
					<button
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
						type="button"
					>
						{draft.state === 'recording'
							? 'Sync saved audio'
							: 'Retry sync'}
					</button>
				)}
				<details>
					<summary>Remove local copy</summary>
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
				</details>
			</div>
			{actionError && <p role="alert">{actionError}</p>}
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
					aria-labelledby="local-recordings-heading"
					className={style.localRecordings}
				>
					<h2 id="local-recordings-heading">Waiting to sync</h2>
					<p>
						Audio stays in this browser until the server confirms it
						is ready. Keep the journal open to sync automatically,
						or download a backup. Clearing browser data removes
						local copies.
					</p>
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
