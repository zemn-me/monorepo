import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import type { LocalRecording } from '#root/project/me/zemn/app/journal/recording_store.js';

const save = jest.fn<(draft: LocalRecording) => Promise<string>>();
const remove = jest.fn<() => Promise<void>>();
jest.unstable_mockModule('./recording_store.js', () => ({
	saveRecording: save,
	removeRecording: remove,
	recordingLock: (owner: string) => owner,
}));
const { startLocalRecording, maxUploadBytes } = await import('./recording.js');

class Recorder {
	static latest: Recorder;
	static isTypeSupported() {
		return true;
	}
	mimeType = 'audio/webm;codecs=opus';
	audioBitsPerSecond = 64_000;
	state = 'inactive';
	ondataavailable?: (event: { data: Blob }) => void;
	onstop?: () => void;
	onerror?: () => void;
	constructor() {
		Recorder.latest = this;
	}
	start() {
		this.state = 'recording';
	}
	chunk(text: string | Blob) {
		this.ondataavailable?.({
			data: typeof text === 'string' ? new Blob([text]) : text,
		});
	}
	stop() {
		this.state = 'inactive';
		this.chunk('final');
		this.onstop?.();
	}
}
const stopTrack = jest.fn();
const originalRecorder = Object.getOwnPropertyDescriptor(
	globalThis,
	'MediaRecorder'
);
const originalMediaDevices = Object.getOwnPropertyDescriptor(
	navigator,
	'mediaDevices'
);
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
function restore(
	object: object,
	key: string,
	descriptor: PropertyDescriptor | undefined
) {
	if (descriptor) Object.defineProperty(object, key, descriptor);
	else Reflect.deleteProperty(object, key);
}
beforeEach(() => {
	jest.useFakeTimers();
	save.mockReset().mockResolvedValue('saved');
	remove.mockReset().mockResolvedValue(undefined);
	stopTrack.mockReset();
	Object.defineProperty(globalThis, 'MediaRecorder', {
		configurable: true,
		value: Recorder,
	});
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: {
			getUserMedia: async () => ({
				getTracks: () => [{ stop: stopTrack }],
			}),
		},
	});
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		value: {
			request: async (
				_name: string,
				_options: unknown,
				action: (lock: object) => Promise<void>
			) => action({}),
		},
	});
});
afterEach(() => {
	jest.useRealTimers();
	restore(globalThis, 'MediaRecorder', originalRecorder);
	restore(navigator, 'mediaDevices', originalMediaDevices);
	restore(navigator, 'locks', originalLocks);
});

it('keeps recording beyond thirty minutes and the transcription file limit', async () => {
	const finished = jest.fn();
	const tick = jest.fn();
	const session = await startLocalRecording('owner', { tick, finished });
	Recorder.latest.chunk(new Blob([new Uint8Array(26_000_000)]));
	jest.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
	await jest.advanceTimersByTimeAsync(250);
	expect(Recorder.latest.state).toBe('recording');
	expect(tick).toHaveBeenLastCalledWith(2 * 60 * 60 * 1000 + 250);
	expect(finished).not.toHaveBeenCalled();
	session.stop();
	await session.done;
	const final = save.mock.calls.at(-1)?.[0];
	expect(final?.state).toBe('queued');
	expect(final?.parts.map(part => part.size)).toEqual([26_000_000, 5]);
	expect(finished).toHaveBeenCalledWith(final, true, undefined);
});

it('retains completed audio for download if a checkpoint and final save fail', async () => {
	const finished = jest.fn();
	const session = await startLocalRecording('owner', {
		tick: () => undefined,
		finished,
	});
	save.mockRejectedValue(new Error('Quota exceeded'));
	Recorder.latest.chunk('first');
	await session.done;
	expect(finished).toHaveBeenCalledWith(
		expect.objectContaining({
			state: 'queued',
			parts: expect.arrayContaining([expect.any(Blob)]),
		}),
		false,
		expect.stringContaining('Download')
	);
	const draft = finished.mock.calls[0]?.[0] as LocalRecording;
	expect(draft.parts.reduce((size, part) => size + part.size, 0)).toBe(10);
});

it('retains the start timestamp when a recording spans midnight and a clock change', async () => {
 jest.setSystemTime(new Date('2026-11-01T03:59:00Z'));
 const finished = jest.fn();
 const session = await startLocalRecording('owner', {tick: jest.fn(), finished});
 Recorder.latest.chunk('before midnight');
 jest.setSystemTime(new Date('2026-11-01T07:30:00Z'));
 session.stop();
 await session.done;
 const draft = finished.mock.calls[0]?.[0] as LocalRecording;
 expect(draft.recordedAt).toBe('2026-11-01T03:59:00.000Z');
 expect(draft.recordingStartedAt).toBe(draft.recordedAt);
 expect(save.mock.calls.at(-1)?.[0].recordingStartedAt).toBe(draft.recordedAt);
});

it('does not record if durable storage cannot be opened', async () => {
	save.mockRejectedValue(new Error('Storage unavailable'));
	await expect(
		startLocalRecording('owner', {
			tick: () => undefined,
			finished: () => undefined,
		})
	).rejects.toThrow('Storage unavailable');
	expect(Recorder.latest.state).toBe('inactive');
	expect(stopTrack).toHaveBeenCalled();
});

it('cancelling removes the draft even when the recorder emits its final chunk', async () => {
	const finished = jest.fn();
	const session = await startLocalRecording('owner', {
		tick: () => undefined,
		finished,
	});
	Recorder.latest.chunk('discard this');
	session.stop(true);
	await session.done;
	expect(remove).toHaveBeenCalled();
	expect(finished).toHaveBeenCalledWith(undefined, false, undefined);
	expect(save.mock.calls.some(([draft]) => draft.state === 'queued')).toBe(
		false
	);
});

it('retains a final download if the worker upload budget is reached', async () => {
	const finished = jest.fn();
	const session = await startLocalRecording('owner', {
		tick: () => undefined,
		finished,
	});
	const large = new Blob(['audio']);
	Object.defineProperty(large, 'size', { value: maxUploadBytes });
	Recorder.latest.chunk(large);
	await session.done;
	expect(Recorder.latest.state).toBe('inactive');
	expect(finished).toHaveBeenCalledWith(
		expect.objectContaining({ state: 'queued' }),
		true,
		expect.stringContaining('256 MiB')
	);
});
