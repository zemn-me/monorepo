import { mp4, ogv, poster, webm } from '#root/project/zemn.me/public/kenwood';

export { poster }

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
