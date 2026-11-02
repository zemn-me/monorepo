import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LocalRecording } from './recording_store.js';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	value: true,
	configurable: true,
});

let saved: LocalRecording[] = [];
const removeRecording = jest.fn(async (_owner: string, id: string) => {
	saved = saved.filter(draft => draft.id !== id);
});
jest.unstable_mockModule('./style.module.css', () => ({ default: {} }));
jest.unstable_mockModule('./recording_store.js', () => ({
	listRecordings: async () => saved,
	getRecording: async (_owner: string, id: string) =>
		saved.find(draft => draft.id === id),
	saveRecording: async (draft: LocalRecording) => {
		saved = [...saved.filter(item => item.id !== draft.id), draft];
	},
	removeRecording,
	recordingBlob: () => new NodeBlob(['abc']),
	recordingLock: (owner: string) => `recording:${owner}`,
}));
const { LocalRecordings, useRecordingQueue } = await import(
	'./recording_queue.js'
);
type Options = Parameters<typeof useRecordingQueue>[0];
const draft: LocalRecording = {
	id: 'local',
	owner: 'owner',
	name: 'voice-note.webm',
	parts: [],
	recordedAt: '2026-10-01T01:30:00Z',
	timeZone: 'UTC',
	contentType: 'audio/webm',
	state: 'uploaded',
	remoteEntryID: 'duplicate',
	uploadedAt: Date.now(),
};
const completed: Options['entries'][number] = {
	id: 'original',
	schemaVersion: 1,
	recordedAt: draft.recordedAt,
	timeZone: 'UTC',
	contentType: 'audio/webm',
	status: 'ready',
	transcript: [],
	byteLength: 3,
	contentSha256:
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
};
let root: Root;
let container: HTMLDivElement;
const upload = jest.fn<Options['upload']>();
beforeEach(() => {
	saved = [{ ...draft }];
	removeRecording.mockClear();
	upload.mockReset();
	const heldLocks = new Set<string>();
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		value: {
			request: async (
				name: string,
				_options: unknown,
				callback: (lock: object | null) => Promise<void>
			) => {
				if (heldLocks.has(name)) return callback(null);
				heldLocks.add(name);
				try {
					await callback({});
				} finally {
					heldLocks.delete(name);
				}
			},
		},
	});
	Object.defineProperty(crypto, 'subtle', {
		configurable: true,
		value: webcrypto.subtle,
	});
	Object.defineProperty(URL, 'createObjectURL', {
		configurable: true,
		value: () => 'blob:local',
	});
	Object.defineProperty(URL, 'revokeObjectURL', {
		configurable: true,
		value: () => undefined,
	});
	container = document.createElement('div');
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
});
function Harness({
	entries,
	capture,
}: {
	readonly entries: Options['entries'];
	readonly capture: (queue: ReturnType<typeof useRecordingQueue>) => void;
}) {
	const queue = useRecordingQueue({
		owner: 'owner',
		canSync: true,
		upload,
		entries,
		readyEntryIDs: entries
			.filter(entry => entry.status === 'ready')
			.map(entry => entry.id),
	});
	capture(queue);
	return <LocalRecordings queue={queue} />;
}
async function render(entries: Options['entries'] = []) {
	let queue!: ReturnType<typeof useRecordingQueue>;
	await act(async () => {
		root.render(
			<Harness
				entries={entries}
				capture={value => {
					queue = value;
				}}
			/>
		);
		// Let Web Crypto and the asynchronous recording store settle.
		await new Promise(resolve => setTimeout(resolve, 30));
	});
	await act(async () => {
		await new Promise(resolve => setTimeout(resolve, 30));
	});
	return queue;
}
it('shows the upload error beside the saved recording and keeps the audio', async () => {
	saved = [{ ...draft, state: 'queued', remoteEntryID: undefined }];
	upload.mockRejectedValue(new Error('Audio upload failed (403).'));
	await render();
	expect(container.querySelector('details')?.open).toBe(true);
	expect(container.querySelector('[role="alert"]')?.textContent).toContain(
		'Audio upload failed (403).'
	);
	expect(container.querySelector('[role="alert"]')?.textContent).toContain(
		'Will retry automatically.'
	);
	expect(container.querySelector('a[download]')).not.toBeNull();
	expect(removeRecording).not.toHaveBeenCalled();
	expect(upload).toHaveBeenCalledTimes(1);
});
it.each(['Audio could not be decoded.', undefined])(
	'shows processing failures and enables immediate retry: %s',
	async error => {
		await render([
			{ ...completed, id: draft.remoteEntryID!, status: 'failed', error },
		]);
		expect(container.querySelector('details')?.open).toBe(true);
		expect(
			container.querySelector('[aria-label="Processing failed"]')
		).not.toBeNull();
		expect(
			container.querySelector('[role="alert"]')?.textContent
		).toContain(error ?? 'Could not process this voice note.');
		expect(
			container.querySelector<HTMLButtonElement>(
				'button[aria-label="Retry sync"]'
			)?.disabled
		).toBe(false);
		expect(removeRecording).not.toHaveBeenCalled();
	}
);
it('recognizes a completed duplicate by its exact audio hash', async () => {
	await render([completed]);
	expect(removeRecording).toHaveBeenCalledWith('owner', draft.id);
	expect(
		container.querySelector('section[aria-label="Local recordings"]')
	).toBeNull();
	expect(upload).not.toHaveBeenCalled();
});
it.each([
	{ ...completed, contentSha256: '0'.repeat(64) },
	{ ...completed, status: 'processing' as const },
	{ ...completed, status: 'failed' as const },
	{ ...completed, contentSha256: undefined },
])(
	'retains an unconfirmed recording when no completed audio matches: %j',
	async entry => {
		saved = [{ ...draft, uploadedAt: Date.now() - 180_000 }];
		await render([entry]);
		expect(removeRecording).not.toHaveBeenCalled();
		expect(
			container.querySelector('[role="alert"]')?.textContent
		).toContain('Could not confirm this upload.');
		expect(
			container.querySelector('[aria-label="Transcribing voice note"]')
		).toBeNull();
	}
);

it.each(['original', 'duplicate'])(
	'reconciles a newly confirmed %s without waiting for the retry timer',
	async kind => {
		const id = kind === 'original' ? draft.remoteEntryID! : completed.id;
		await render([{ ...completed, id, status: 'processing' }]);
		expect(removeRecording).not.toHaveBeenCalled();
		await render([{ ...completed, id, status: 'ready' }]);
		expect(removeRecording).toHaveBeenCalledWith('owner', draft.id);
		expect(
			container.querySelector('section[aria-label="Local recordings"]')
		).toBeNull();
	}
);

it('drains recordings added while an earlier upload owns the synchronization lock', async () => {
	saved = [];
	let held = false;
	Object.defineProperty(navigator, 'locks', {
		configurable: true,
		value: {
			request: async (
				_name: string,
				_options: unknown,
				callback: (lock: object | null) => Promise<void>
			) => {
				if (held) return callback(null);
				held = true;
				try {
					await callback({});
				} finally {
					held = false;
				}
			},
		},
	});
	const first = Promise.withResolvers<{ id: string }>();
	upload
		.mockReturnValueOnce(first.promise)
		.mockResolvedValue({ id: 'remote-second' });
	const queue = await render();
	await act(async () =>
		queue.keep({
			...draft,
			id: 'first',
			state: 'queued',
			remoteEntryID: undefined,
		})
	);
	await act(async () =>
		queue.keep({
			...draft,
			id: 'second',
			state: 'queued',
			remoteEntryID: undefined,
		})
	);
	expect(upload).toHaveBeenCalledTimes(1);
	await act(async () => first.resolve({ id: 'remote-first' }));
	await act(async () => {
		await new Promise(resolve => setTimeout(resolve, 30));
	});
	expect(upload).toHaveBeenCalledTimes(2);
	expect(removeRecording).not.toHaveBeenCalled();
});
