import Head from 'next/head';
import * as git from 'monorepo/git';

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
				<a href="https://twitter.com/zemnmez">follow me on Twitter</a>?
			</p>

			<p>
				Built from <a href={git.head.link}>{git.head.ref}</a>.
			</p>
		</>
	);
}
