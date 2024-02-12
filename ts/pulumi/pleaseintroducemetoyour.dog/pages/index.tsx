import Head from 'next/head';

import Link from '#root/project/zemn.me/components/Link/Link.js';

export default function Main() {
	return (
		<>
			<Head>
				<title>pleaseintroducemetoyour.dog</title>
			</Head>

			<h1>Pleaseintroducemetoyour.dog</h1>
			<p>One day something will go here!</p>
			<p>
				Until then,{' '}
				<Link href="https://twitter.com/zemnmez">
					follow me on Twitter
				</Link>
				?
			</p>
		</>
	);
}
