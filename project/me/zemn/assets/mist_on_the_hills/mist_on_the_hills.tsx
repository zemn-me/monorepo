import {
	jpg,
	mp4,
	ogv,
	webm,
} from '#root/project/me/zemn/assets/mist_on_the_hills/sources.js';

export const poster = { src: jpg } as const;

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
