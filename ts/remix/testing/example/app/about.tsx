import { Link } from '#root/ts/react/router/Link/index.js';
export function loader() {
	return { message: 'Prerendered loader data' };
}
export default function About({
	loaderData,
}: {
	loaderData: ReturnType<typeof loader>;
}) {
	return (
		<main>
			<h1>About this site</h1>
			<p>{loaderData.message}</p>
			<Link href="/">Home</Link>
		</main>
	);
}
export const handle = { metadata: { title: 'About' } };
