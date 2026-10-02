import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createRequestHandler } from 'react-router';

export const publicCache =
	'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const privateCache = 'private, no-store';
// These are the only varying request headers included in the CloudFront cache key.
const cacheHeaders = new Set([
	'accept-encoding',
	'accept',
	'origin',
	'authorization',
	'cookie',
]);

export function protectCache(request, response) {
	const headers = new Headers(response.headers);
	const cache = response.headers.get('cache-control') ?? '';
	const vary = (response.headers.get('vary') ?? '')
		.toLowerCase()
		.split(',')
		.map(value => value.trim())
		.filter(Boolean);
	if (
		!['GET', 'HEAD'].includes(request.method) ||
		request.headers.has('authorization') ||
		request.headers.has('cookie') ||
		response.headers.has('set-cookie') ||
		response.status >= 400 ||
		vary.some(header => !cacheHeaders.has(header)) ||
		!/(?:^|,)\s*public\s*(?:,|$)/i.test(cache) ||
		/(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(cache)
	)
		headers.set('cache-control', privateCache);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function createApp(build, prerendered, directory) {
	const render = createRequestHandler(build, 'production');
	return async request => {
		const url = new URL(request.url);
		const file = Object.hasOwn(prerendered, url.pathname)
			? prerendered[url.pathname]
			: undefined;
		// A build-time snapshot cannot answer query-dependent or authenticated loaders.
		if (
			file &&
			!url.search &&
			['GET', 'HEAD'].includes(request.method) &&
			!request.headers.has('authorization') &&
			!request.headers.has('cookie')
		) {
			return new Response(
				request.method === 'HEAD'
					? null
					: await readFile(new URL(file, directory)),
				{
					headers: {
						'content-type': file.endsWith('.data')
							? 'text/x-script; charset=utf-8'
							: 'text/html; charset=utf-8',
						'cache-control': publicCache,
					},
				}
			);
		}
		return protectCache(request, await render(request));
	};
}

/** API Gateway HTTP API payload v2 preserves raw queries, binary bodies and cookies. */
export function createLambdaHandler(handleRequest) {
	return async event => {
		const headers = new Headers(event.headers);
		const expected = Buffer.from(process.env.REMIX_ORIGIN_SECRET ?? '');
		const supplied = Buffer.from(
			headers.get('x-remix-origin-secret') ?? ''
		);
		if (
			!expected.length ||
			expected.length !== supplied.length ||
			!timingSafeEqual(expected, supplied)
		)
			return {
				statusCode: 403,
				headers: { 'cache-control': privateCache },
				body: 'Forbidden',
			};
		headers.delete('x-remix-origin-secret');
		if (event.cookies?.length)
			headers.set('cookie', event.cookies.join('; '));
		// Use the configured viewer origin, never the API Gateway Host or a client-supplied proxy header.
		const origin = process.env.PUBLIC_ORIGIN;
		if (!origin) throw new Error('PUBLIC_ORIGIN is required');
		const url = new URL(origin);
		url.pathname = event.rawPath;
		url.search = event.rawQueryString;
		headers.set('host', url.host);
		const method = event.requestContext.http.method;
		const request = new Request(url, {
			method,
			headers,
			body: ['GET', 'HEAD'].includes(method)
				? undefined
				: Buffer.from(
						event.body ?? '',
						event.isBase64Encoded ? 'base64' : 'utf8'
					),
			signal: AbortSignal.timeout(25_000),
		});
		const response = await handleRequest(request);
		const responseHeaders = Object.fromEntries(response.headers);
		delete responseHeaders['set-cookie'];
		return {
			statusCode: response.status,
			headers: responseHeaders,
			cookies: response.headers.getSetCookie(),
			body:
				method === 'HEAD'
					? ''
					: Buffer.from(await response.arrayBuffer()).toString(
							'base64'
						),
			isBase64Encoded: true,
		};
	};
}

export function createNodeListener(handleRequest) {
	return async (incoming, outgoing) => {
		const controller = new AbortController();
		outgoing.on('close', () => controller.abort());
		try {
			const request = new Request(
				new URL(incoming.url, `http://${incoming.headers.host}`),
				{
					method: incoming.method,
					headers: incoming.headers,
					body: ['GET', 'HEAD'].includes(incoming.method)
						? undefined
						: Readable.toWeb(incoming),
					duplex: 'half',
					signal: controller.signal,
				}
			);
			const response = await handleRequest(request);
			outgoing.writeHead(response.status, {
				...Object.fromEntries(response.headers),
				'set-cookie': response.headers.getSetCookie(),
			});
			if (response.body && incoming.method !== 'HEAD')
				Readable.fromWeb(response.body)
					.on('error', error => outgoing.destroy(error))
					.pipe(outgoing);
			else outgoing.end();
		} catch (error) {
			console.error(error);
			if (!outgoing.headersSent)
				outgoing.writeHead(500, { 'cache-control': privateCache });
			outgoing.end();
		}
	};
}
