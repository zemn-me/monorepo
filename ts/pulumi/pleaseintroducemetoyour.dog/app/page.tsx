import { Metadata } from 'next/types/index.js';

import { Link } from '#root/ts/react/next/Link/index.js';

export default function Main() {
	return (
		<>
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

export const metadata: Metadata = {
	title: 'Home',
};
