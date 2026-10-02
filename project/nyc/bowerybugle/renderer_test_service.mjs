import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { fetchPage } = await import(
	pathToFileURL(
		path.resolve('project/nyc/bowerybugle/server_build/handler.mjs')
	)
);
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
// Only this test adapter accepts origin overrides, so the Go httptest API and
// HTTPS browser fixture can share the production renderer on assigned ports.
createServer(async (req, res) => {
	if (req.url === '/health') {
		res.end('ok');
		return;
	}
	try {
		const site = req.headers['x-test-site-origin'];
		const apiOrigin = new URL(site);
		apiOrigin.hostname = `api.${apiOrigin.hostname}`;
		const response = await fetchPage(
			new Request(new URL(req.url, site), { method: req.method }),
			{
				apiOrigin: apiOrigin.origin,
				apiFetchOrigin: req.headers['x-test-api-origin'],
			}
		);
		res.writeHead(response.status, Object.fromEntries(response.headers));
		res.end(Buffer.from(await response.arrayBuffer()));
	} catch (error) {
		console.error(error);
		res.writeHead(500);
		res.end('Render failed');
	}
}).listen(port, '127.0.0.1');
