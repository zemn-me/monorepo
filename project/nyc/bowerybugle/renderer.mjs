import { createRequestHandler, RouterContextProvider } from 'react-router';

export function createHandler(build) {
	const render = createRequestHandler(build, 'production');

	async function fetchPage(request, context) {
		if (!['GET', 'HEAD'].includes(request.method))
			return new Response('Method not allowed', {
				status: 405,
				headers: { Allow: 'GET, HEAD' },
			});
		const loadContext = new RouterContextProvider();
		loadContext.set(build.entry.module.apiContext, context);
		const response = await render(request, loadContext);
		// Fresh issues on every document/navigation request. Static assets are cached
		// separately by CloudFront; no session-dependent HTML enters a shared cache.
		response.headers.set('Cache-Control', 'no-store');
		response.headers.set('Referrer-Policy', 'no-referrer');
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('X-Frame-Options', 'DENY');
		return response;
	}

	async function handler(event) {
		const origin = process.env.SITE_ORIGIN;
		const apiOrigin = process.env.API_ORIGIN;
		if (!origin || !apiOrigin)
			throw new Error('Site and API origins must be configured');
		const url = new URL(origin);
		url.pathname = event.rawPath;
		url.search = event.rawQueryString;
		// Do not forward viewer cookies, authorization or host headers to the API.
		const request = new Request(url, {
			method: event.requestContext.http.method,
		});
		const response = await fetchPage(request, { apiOrigin });
		return {
			statusCode: response.status,
			headers: Object.fromEntries(response.headers),
			body: Buffer.from(await response.arrayBuffer()).toString('base64'),
			isBase64Encoded: true,
		};
	}

	return { fetchPage, handler };
}
