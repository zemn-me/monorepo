const mp4 = '/kenwood.mp4';
const webm = '/kenwood.webm';
const ogv = '/kenwood.ogv';

export const poster = { src: '/kenwood.jpg' } as const;

/**
 * @returns A React element representing the Kenwood video asset
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
