import { isRouteErrorResponse, useRouteError } from 'react-router';

export function NotFound() {
	return (
		<main>
			<h1>Page not found</h1>
			<p>The page you requested could not be found.</p>
		</main>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	if (isRouteErrorResponse(error) && error.status === 404)
		return <NotFound />;
	return (
		<main>
			<h1>Something went wrong</h1>
			<p>Please reload the page to try again.</p>
		</main>
	);
}
