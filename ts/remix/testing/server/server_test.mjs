import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const { handleRequest, handler, createNodeListener } = await import(
	pathToFileURL(path.resolve('ts/remix/testing/server/server/handler.mjs'))
		.href
);
const get = url => handleRequest(new Request('https://example.com' + url));

test('unlisted routes run fresh loaders and preserve route cache headers for HTML and data', async () => {
	const first = await get('/live?name=Alice');
	const firstHTML = await first.text();
	assert.match(firstHTML, /Alice/);
	assert.equal(
		first.headers.get('cache-control'),
		'public, max-age=0, s-maxage=60'
	);
	const secondHTML = await (await get('/live?name=Bob')).text();
	assert.match(secondHTML, /Bob/);
	assert.notEqual(
		firstHTML.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)[0],
		secondHTML.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)[0]
	);
	const data = await get('/live.data?name=Charlie');
	assert.match(data.headers.get('content-type'), /text\/x-script/);
	assert.match(await data.text(), /Charlie/);
	assert.equal(
		data.headers.get('cache-control'),
		'public, max-age=0, s-maxage=60'
	);
	const privateResponse = await handleRequest(
		new Request('https://example.com/live?name=Alice', {
			headers: { authorization: 'Bearer alice' },
		})
	);
	assert.equal(
		privateResponse.headers.get('cache-control'),
		'private, no-store'
	);
});

test('a real Remix form action works through the Lambda HTTP API adapter', async () => {
	process.env.PUBLIC_ORIGIN = 'https://example.com';
	process.env.REMIX_ORIGIN_SECRET = 'test';
	const response = await handler({
		rawPath: '/live',
		rawQueryString: '',
		requestContext: { http: { method: 'POST' } },
		headers: {
			'x-remix-origin-secret': 'test',
			'content-type': 'application/x-www-form-urlencoded',
			origin: 'https://example.com',
		},
		body: 'name=After+submit',
	});
	assert.equal(response.statusCode, 303);
	assert.equal(response.headers.location, '/live?name=After%20submit');
	assert.equal(response.headers['cache-control'], 'private, no-store');
});

test('the production Node listener accepts forms and preserves HTTP redirects', async () => {
	const server = createServer(createNodeListener(handleRequest));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	try {
		const url = `http://127.0.0.1:${server.address().port}/live`;
		const response = await fetch(url, {
			method: 'POST',
			body: new URLSearchParams({ name: 'Browser form' }),
			redirect: 'manual',
		});
		assert.equal(response.status, 303);
		assert.equal(
			response.headers.get('location'),
			'/live?name=Browser%20form'
		);
		assert.equal(
			response.headers.get('cache-control'),
			'private, no-store'
		);
		const document = await fetch(
			new URL(response.headers.get('location'), url)
		);
		assert.match(await document.text(), /Browser form/);
	} finally {
		await new Promise((resolve, reject) =>
			server.close(error => (error ? reject(error) : resolve()))
		);
	}
});
