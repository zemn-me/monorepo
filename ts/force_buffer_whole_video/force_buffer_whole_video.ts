/**
 * @fileoverview The content of this file is a script which can be used to
 * fully buffer an HTML <video> element in an automatic manner which appears
 * user-initiated and is practically speaking, impossible to prevent without
 * attempting to detect this specific script.
 *
 * Some websites implement server-side controls to prevent downloading of video consisting
 * of rate-limits, origin checks, user-agent checks, XSRF tokens, frequently changing
 * cookies etc.
 *
 * This script locates the first <video> element in the page, and then seeks through the
 * video, forcing it to buffer in the minimum time possible.
 *
 * Once the video is fully buffered, the user can right-click on the video and use 'save as'
 * to download the browser's in-memory copy of it.
 */

function totalTimeRangeSize(t: TimeRanges): number {
	let ctr = 0;

	for (let i = 0; i < t.length; i++) {
		ctr += t.end(i) - t.start(i);
	}

	return ctr;
}

function totalBufferedSize(v: Pick<HTMLVideoElement, 'buffered'>): number {
	return totalTimeRangeSize(v.buffered);
}

function didVideoBufferGrow(
	video: HTMLVideoElement,
	sampleTimeMs: number
): Promise<boolean> {
	const initialSize = totalBufferedSize(video);
	return new Promise(ok => {
		setTimeout(
			() => ok(totalBufferedSize(video) > initialSize),
			sampleTimeMs
		);
	});
}

async function awaitBufferingStarted(
	video: HTMLVideoElement,
	sampleTimeMs: number
): Promise<void> {
	for (;;) {
		if (await didVideoBufferGrow(video, sampleTimeMs)) break;
	}
}

async function awaitBufferingStopped(
	video: HTMLVideoElement,
	sampleTimeMs: number
): Promise<void> {
	for (;;) {
		if (!(await didVideoBufferGrow(video, sampleTimeMs))) break;
	}
}

function videoTotallyBuffered(v: HTMLVideoElement): boolean {
	return totalBufferedSize(v) >= v.duration;
}

async function forceBufferWholeVideo(video: HTMLVideoElement) {
	while (!videoTotallyBuffered(video)) {
		console.info(
			`loaded ${(totalBufferedSize(video) * 100) / video.duration}% in ${
				video.buffered.length
			} chunks.`
		);
		// attempt to load video from the end of the buffered chunk.
		const lastBufferedTime = video.buffered.end(0);

		video.currentTime = lastBufferedTime;

		// wait for buffering to begin
		await awaitBufferingStarted(video, 1000);

		// wait for buffering to complete
		await awaitBufferingStopped(video, 1000);
	}

	console.info('whole video is buffered.');
}

async function main() {
	const video = document.querySelector('video');
	if (!video) throw new Error('Missing video element.');
	await forceBufferWholeVideo(video);
}

void main().catch(e => console.error(e));
