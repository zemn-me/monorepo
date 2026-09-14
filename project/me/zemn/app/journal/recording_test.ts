import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';

import type { LocalRecording } from '#root/project/me/zemn/app/journal/recording_store.js';

const save = jest.fn<(draft: LocalRecording) => Promise<string>>();
const remove = jest.fn<() => Promise<void>>();
jest.unstable_mockModule('./recording_store.js', () => ({
	saveRecording: save,
	removeRecording: remove,
	recordingLock: (owner: string) => owner,
}));
const {
	startLocalRecording,
	remainingRecordingMilliseconds,
	maxRecordingMilliseconds,
} = await import('./recording.js');

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
	chunk(text: string) {
		this.ondataavailable?.({ data: new Blob([text]) });
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

it('automatically finalizes at the time limit, including the last audio chunk', async () => {
	const finished = jest.fn();
	const tick = jest.fn();
	const session = await startLocalRecording('owner', { tick, finished });
	Recorder.latest.chunk('first');
	await jest.advanceTimersByTimeAsync(maxRecordingMilliseconds);
	await session.done;
	expect(Recorder.latest.state).toBe('inactive');
	expect(stopTrack).toHaveBeenCalled();
	expect(tick).toHaveBeenLastCalledWith(0);
	const final = save.mock.calls.at(-1)?.[0];
	expect(final?.state).toBe('queued');
	expect(final?.parts.map(part => part.size)).toEqual([5, 5]);
	expect(finished).toHaveBeenCalledWith(
		final,
		true,
		expect.stringContaining('limit')
	);
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

it('uses a byte safeguard and shortens the countdown for faster encoders', () => {
	expect(remainingRecordingMilliseconds(0, 0, 0, 64_000)).toBe(
		maxRecordingMilliseconds
	);
	expect(remainingRecordingMilliseconds(0, 1000, 23_000_000, 64_000)).toBe(0);
	expect(remainingRecordingMilliseconds(0, 0, 0, 256_000)).toBeLessThan(
		maxRecordingMilliseconds
	);
	expect(
		remainingRecordingMilliseconds(
			0,
			maxRecordingMilliseconds + 10_000,
			0,
			64_000
		)
	).toBe(0);
});
