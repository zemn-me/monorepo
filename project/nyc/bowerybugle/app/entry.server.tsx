import { renderToReadableStream } from 'react-dom/server';
import { type EntryContext, ServerRouter } from 'react-router';

// Export the same context key used by loaders for the bundled server adapter.
export { apiContext } from './server-context.js';

export default async function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	context: EntryContext
) {
	if (request.method === 'HEAD')
		return new Response(null, { status, headers });
	const stream = await renderToReadableStream(
		<ServerRouter context={context} url={request.url} />,
		{
			signal: AbortSignal.any([
				request.signal,
				AbortSignal.timeout(8000),
			]),
			onError(error) {
				status = 500;
				// biome-ignore lint/suspicious/noConsole: rendering failures must reach server logs
				console.error(error);
			},
		}
	);
	// The archive is small; send complete HTML so the first paint has every issue.
	await stream.allReady;
	headers.set('Content-Type', 'text/html; charset=utf-8');
	return new Response(stream, { status, headers });
}
