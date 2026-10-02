import { Link } from '#root/ts/react/router/Link/index.js';
import { Metadata } from '#root/ts/remix/metadata.js';

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

export const handle = { metadata };
