import { useState } from 'react';
import { Link } from '#root/ts/react/router/Link/index.js';

export default function Home() {
	const [count, setCount] = useState(0);
	return (
		<main>
			<h1>Hello, world!</h1>
			<button onClick={() => setCount(count + 1)} type="button">
				Count: {count}
			</button>
			<Link href="/about">About</Link>
		</main>
	);
}
export const handle = { metadata: { title: 'Home' } };
