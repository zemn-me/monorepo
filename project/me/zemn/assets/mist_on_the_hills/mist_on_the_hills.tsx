const mp4 = '/mist_on_the_hills.mp4';
const webm = '/mist_on_the_hills.webm';
const ogv = '/mist_on_the_hills.ogv';

export const poster = { src: '/mist_on_the_hills.jpg' } as const;

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
