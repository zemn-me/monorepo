import { mp4, ogv, poster, webm } from '#root/project/zemn.me/public/mist_on_the_hills.js';

export { poster }

/**
 * @returns A React element representing the a video asset
 * in several source formats. Note that the <video> element is NOT
 * provided.
 */
export function VideoSources() {
	return (
		<>
			<source src={mp4} type="video/mp4" />
			<source src={webm} type="video/webm" />
			<source src={ogv} type="video/ogv" />
		</>
	);
}

