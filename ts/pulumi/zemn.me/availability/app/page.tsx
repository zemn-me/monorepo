import { ClientSideRedirect } from '#root/ts/pulumi/zemn.me/availability/app/client.js';
import { Link } from '#root/ts/react/next/Link/index.js';

const availabilityURL = 'https://zemn.me/availability';

export default function HomePage() {
	return (
		<main>
			<ClientSideRedirect href={availabilityURL} />
			<meta httpEquiv="refresh" content={`0; url=${availabilityURL}`} />
			<Link href={availabilityURL}>Thomas' availability</Link>
		</main>
	);
}
