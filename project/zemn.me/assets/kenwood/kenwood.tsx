export { default as poster } from 'project/zemn.me/assets/kenwood/kenwood.jpg';

/**
 * @returns A React element representing the Kenwood video asset
 * in several source formats. Note that the <video> element is NOT
 * provided.
 */
export function VideoSources() {
	return (
		<>
			{/* important note!! */}
			{/* These assets only work because they're in the public directory */}
			{/* in the root of this next.js project via a copy_to_bin rule. */}
			{/* no other magic is happening here! */}
			<source src="kenwood.mp4" type="video/mp4" />
			<source src="kenwood.webm" type="video/webm" />
			<source src="kenwood.ogv" type="video/ogv" />
		</>
	);
}
