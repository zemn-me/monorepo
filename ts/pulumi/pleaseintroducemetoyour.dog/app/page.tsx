import { Metadata } from '#root/ts/remix/index.js';

export default function Main() {
	return (
		<>
			<h1>Pleaseintroducemetoyour.dog</h1>
			<p>One day something will go here!</p>
			<p>
				Until then,{' '}
				<a href="https://twitter.com/zemnmez">follow me on Twitter</a>?
			</p>
		</>
	);
}

export const metadata: Metadata = {
	title: 'Home',
};
