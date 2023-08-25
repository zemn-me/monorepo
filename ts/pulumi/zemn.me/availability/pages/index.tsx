/**
 * @fileoverview page to show my availability (for meetings etc)
 */

import Head from 'next/head';

export default function HomePage() {
	return (
		<>
			<Head>
				<meta
					content="object-src https://calendar.google.com"
					httpEquiv="Content-Security-Policy"
				/>
			</Head>
			<main>
				<iframe src="https://calendar.google.com/calendar/u/0/embed?src=thomas@shadwell.im&src=thomas@metatheory.gg&src=thomas.shadwell@gmail.com" />
			</main>
		</>
	);
}
