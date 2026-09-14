import {
	type LocalRecording,
	recordingLock,
	removeRecording,
	saveRecording,
} from '#root/project/me/zemn/app/journal/recording_store.js';

export const maxRecordingMilliseconds = 30 * 60 * 1000;
export const maxUploadBytes = 25_000_000;
const stopRecordingBytes = 23_000_000;
const recordingBitrate = 64_000;

export function remainingRecordingMilliseconds(
	start: number,
	now: number,
	bytes: number,
	bitrate: number
): number {
	const elapsed = Math.max(0, now - start);
	const bytesPerSecond = Math.max(
		bitrate / 8,
		elapsed > 0 ? bytes / (elapsed / 1000) : 0,
		1
	);
	return Math.max(
		0,
		Math.min(
			maxRecordingMilliseconds - elapsed,
			((stopRecordingBytes - bytes) / bytesPerSecond) * 1000
		)
	);
}

export interface RecordingSession {
	readonly stream: MediaStream;
	readonly id: string;
	readonly done: Promise<void>;
	stop(discard?: boolean): void;
}

interface RecordingCallbacks {
	tick(remaining: number): void;
	finished(
		recording: LocalRecording | undefined,
		durable: boolean,
		message?: string
	): void;
}

async function capture(
	owner: string,
	callbacks: RecordingCallbacks
): Promise<RecordingSession> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	let recorder: MediaRecorder;
	let draft: LocalRecording;
	try {
		const mimeType = [
			'audio/webm;codecs=opus',
			'audio/mp4',
			'audio/ogg;codecs=opus',
		].find(type => MediaRecorder.isTypeSupported(type));
		if (!mimeType)
			throw new Error(
				'This browser cannot record a supported audio format.'
			);
		recorder = new MediaRecorder(stream, {
			mimeType,
			audioBitsPerSecond: recordingBitrate,
		});
		const contentType = recorder.mimeType.split(';')[0];
		if (
			contentType !== 'audio/webm' &&
			contentType !== 'audio/mp4' &&
			contentType !== 'audio/ogg'
		) {
			throw new Error(
				'This browser cannot record a supported audio format.'
			);
		}
		const recordedAt = new Date().toISOString();
		draft = {
			id: crypto.randomUUID(),
			owner,
			recordedAt,
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			contentType,
			name: `voice-note-${recordedAt.replaceAll(':', '-')}.${contentType === 'audio/mp4' ? 'm4a' : contentType.split('/')[1]}`,
			parts: [],
			state: 'recording',
		};
		await saveRecording(draft);
	} catch (error) {
		stream.getTracks().forEach(track => track.stop());
		throw error;
	}
	let discard = false;
	let bytes = 0;
	let message: string | undefined;
	let writes = Promise.resolve();
	const parts: Blob[] = [];
	const start = Date.now();
	let finish!: () => void;
	const done = new Promise<void>(resolve => {
		finish = resolve;
	});
	const stop = (shouldDiscard = false) => {
		if (recorder.state !== 'inactive') {
			discard = shouldDiscard;
			recorder.stop();
		}
	};
	const checkLimit = () => {
		if (recorder.state === 'inactive') return;
		const remaining = remainingRecordingMilliseconds(
			start,
			Date.now(),
			bytes,
			recorder.audioBitsPerSecond || recordingBitrate
		);
		callbacks.tick(remaining);
		if (remaining <= 0) {
			message =
				'Recording stopped at its limit. Your voice note has been kept.';
			stop();
		}
	};
	const timer = window.setInterval(checkLimit, 250);
	recorder.ondataavailable = event => {
		if (event.data.size === 0) return;
		parts.push(event.data);
		bytes += event.data.size;
		const checkpoint = { ...draft, parts: [...parts] };
		writes = writes.then(async () => {
			try {
				await saveRecording(checkpoint);
			} catch {
				message =
					'Device storage is full or unavailable. Download this recording before leaving the page.';
				stop();
			}
		});
		checkLimit();
	};
	recorder.onerror = () => {
		message =
			'Recording was interrupted. The captured audio has been kept.';
		stop();
	};
	recorder.onstop = () => {
		window.clearInterval(timer);
		stream.getTracks().forEach(track => track.stop());
		void writes
			.then(async () => {
				const completed = {
					...draft,
					parts: [...parts],
					state: 'queued' as const,
				};
				let durable = false;
				try {
					if (discard || bytes === 0)
						await removeRecording(owner, draft.id);
					else {
						await saveRecording(completed);
						durable = true;
					}
				} catch {
					message =
						'Could not save all audio on this device. Download the recording before leaving this page.';
				}
				callbacks.finished(
					discard || bytes === 0 ? undefined : completed,
					durable,
					message
				);
			})
			.finally(finish);
	};
	try {
		recorder.start(1000);
	} catch (error) {
		window.clearInterval(timer);
		stream.getTracks().forEach(track => track.stop());
		await removeRecording(owner, draft.id);
		throw error;
	}
	checkLimit();
	return { stream, id: draft.id, done, stop };
}

// Keep other tabs from recovering or discarding a recording still being captured.
export function startLocalRecording(
	owner: string,
	callbacks: RecordingCallbacks
): Promise<RecordingSession> {
	return new Promise((resolve, reject) => {
		void navigator.locks
			.request(
				recordingLock(owner),
				{ ifAvailable: true },
				async lock => {
					if (!lock)
						throw new Error(
							'A journal recording is already running in another tab.'
						);
					const session = await capture(owner, callbacks);
					resolve(session);
					await session.done;
				}
			)
			.catch(reject);
	});
}
