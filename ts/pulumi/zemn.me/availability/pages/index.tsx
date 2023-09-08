/**
 * @fileoverview page to show my availability (for meetings etc)
 */

const target = 'https://zemn.me/availability';

export default function HomePage() {
	document.location = target;
	return (
		<>
			<main>
				<p>
					This page has been moved to <a href={target}>{target}</a>.
				</p>
			</main>
		</>
	);
}
