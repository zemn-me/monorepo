import { Link } from '#root/ts/react/next/Link/index.js';

const availabilityURL = 'https://zemn.me/availability';

export default function HomePage() {
	return (
		<main>
			<meta httpEquiv="refresh" content={`0; url=${availabilityURL}`} />
			<Link href={availabilityURL}>Thomas' availability</Link>
		</main>
	);
}
