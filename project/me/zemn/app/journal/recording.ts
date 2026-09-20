import {
	type LocalRecording,
	recordingLock,
	removeRecording,
	saveRecording,
} from '#root/project/me/zemn/app/journal/recording_store.js';

// Keep uploads within the worker's storage budget. Transcription pieces are
// bounded separately on the server; recording has no fixed time limit.
export const maxUploadBytes = 256 * 1024 * 1024;
const stopRecordingBytes = maxUploadBytes - 2_000_000;
const recordingBitrate = 64_000;

export interface RecordingSession {
	readonly stream: MediaStream;
	readonly id: string;
	readonly done: Promise<void>;
	stop(discard?: boolean): void;
}

interface RecordingCallbacks {
	tick(elapsed: number): void;
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
	const stream = await navigator.mediaDevices
		.getUserMedia({ audio: true })
		.catch((error: unknown) => {
			if (
				error instanceof DOMException &&
				error.name === 'NotAllowedError'
			) {
				throw new Error(
					'Microphone access is blocked. Allow it in your browser’s website settings, then try again.'
				);
			}
			throw error;
		});
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
		callbacks.tick(Math.max(0, Date.now() - start));
		if (bytes >= stopRecordingBytes) {
			message =
				'Recording reached the 256 MiB upload limit. Your voice note has been kept; you can start another.';
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
	// Capture once at the start, without delaying audio for a permission prompt.
	// A late response must not recreate a stopped or discarded draft.
	navigator.geolocation?.getCurrentPosition(
		position => {
			if (recorder.state === 'inactive') return;
			draft = {
				...draft,
				location: {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracyMeters: position.coords.accuracy,
					capturedAt: new Date(position.timestamp).toISOString(),
				},
			};
			const checkpoint = { ...draft, parts: [...parts] };
			writes = writes.then(async () => {
				try {
					await saveRecording(checkpoint);
				} catch {
					/* Audio checkpoints and final saving report storage failures. */
				}
			});
		},
		() => undefined,
		{ maximumAge: 0, timeout: 10_000, enableHighAccuracy: false }
	);
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
