import { Link } from 'react-router';
export default function NotFound() {
	return (
		<main className="paper">
			<h2>Page not found</h2>
			<Link to="/">Back to The Bowery Bugle</Link>
		</main>
	);
}
export const handle = { metadata: { title: 'Page not found' } };
