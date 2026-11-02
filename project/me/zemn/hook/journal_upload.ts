import type { components } from '#root/project/me/zemn/api/api_client.gen.js';

export function uploadJournalAudio(
	destination: components['schemas']['JournalUpload'],
	file: Blob,
	onProgress?: (progress: number | undefined) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		// Register before open/send so cross-origin uploads report byte progress.
		request.upload.onprogress = event =>
			onProgress?.(
				event.lengthComputable && event.total > 0
					? event.loaded / event.total
					: undefined
			);
		request.upload.onload = () => onProgress?.(undefined);
		request.onload = () => {
			if (request.status >= 200 && request.status < 300) resolve();
			else reject(new Error(`Audio upload failed (${request.status}).`));
		};
		request.onerror = () => reject(new Error('Audio upload failed.'));
		request.ontimeout = () => reject(new Error('Audio upload timed out.'));
		request.onabort = () => reject(new Error('Audio upload cancelled.'));
		request.open(destination.method, destination.url);
		request.timeout = 10 * 60_000;
		for (const [name, value] of Object.entries(destination.headers))
			request.setRequestHeader(name, value);
		onProgress?.(0);
		request.send(file);
	});
}
