import { afterEach, expect, it, jest } from '@jest/globals';
import { uploadJournalAudio } from './journal_upload.js';

const destination = {
	url: 'https://example.com/audio',
	method: 'PUT' as const,
	headers: { 'Content-Type': 'audio/webm' },
	expiresAt: '2026-09-20T12:00:00Z',
};
afterEach(() => { jest.restoreAllMocks(); });

it('reports measured bytes and waits for a successful server response', async () => {
	const request = new XMLHttpRequest();
	jest.spyOn(globalThis, 'XMLHttpRequest').mockImplementation(() => request);
	jest.spyOn(request, 'open').mockImplementation(() => undefined);
	jest.spyOn(request, 'setRequestHeader').mockImplementation(() => undefined);
	const send = jest
		.spyOn(request, 'send')
		.mockImplementation(() => undefined);
	const progress = jest.fn();
	const file = new Blob(['audio']);
	const completed = jest.fn();
	const result = uploadJournalAudio(destination, file, progress).then(
		completed
	);
	expect(send).toHaveBeenCalledWith(file);
	expect(progress).toHaveBeenLastCalledWith(0);
	request.upload.dispatchEvent(
		new ProgressEvent('progress', {
			lengthComputable: true,
			loaded: 25,
			total: 100,
		})
	);
	expect(progress).toHaveBeenLastCalledWith(0.25);
	request.upload.dispatchEvent(new ProgressEvent('progress'));
	expect(progress).toHaveBeenLastCalledWith(undefined);
	request.upload.dispatchEvent(new ProgressEvent('load'));
	await Promise.resolve();
	expect(completed).not.toHaveBeenCalled();
	Object.defineProperty(request, 'status', { value: 200 });
	request.dispatchEvent(new ProgressEvent('load'));
	await result;
	expect(completed).toHaveBeenCalled();
});

it.each(['error', 'timeout', 'abort', 'load'])(
	'rejects an unsuccessful upload: %s',
	async event => {
		const request = new XMLHttpRequest();
		jest.spyOn(globalThis, 'XMLHttpRequest').mockImplementation(
			() => request
		);
		jest.spyOn(request, 'open').mockImplementation(() => undefined);
		jest.spyOn(request, 'setRequestHeader').mockImplementation(
			() => undefined
		);
		jest.spyOn(request, 'send').mockImplementation(() => undefined);
		const result = uploadJournalAudio(destination, new Blob(['audio']));
		Object.defineProperty(request, 'status', { value: 403 });
		request.dispatchEvent(new ProgressEvent(event));
		await expect(result).rejects.toThrow('Audio upload');
	}
);
