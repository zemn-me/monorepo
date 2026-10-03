import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	createLambdaHandler,
	protectCache,
	publicCache,
} from '#root/ts/remix/server.mjs';

test('public caching requires explicit opt-in and a representable cache key', () => {
	for (const [method, requestHeaders, status, responseHeaders, expected] of [
		['GET', {}, 200, { 'cache-control': publicCache }, publicCache],
		['HEAD', {}, 200, { 'cache-control': publicCache }, publicCache],
		['GET', {}, 200, {}, 'private, no-store'],
		[
			'GET',
			{ authorization: 'Bearer first' },
			200,
			{ 'cache-control': publicCache },
			'private, no-store',
		],
		[
			'GET',
			{ cookie: 'session=second' },
			200,
			{ 'cache-control': publicCache },
			'private, no-store',
		],
		[
			'GET',
			{},
			200,
			{ 'cache-control': publicCache, 'set-cookie': 'session=third' },
			'private, no-store',
		],
		[
			'POST',
			{},
			200,
			{ 'cache-control': publicCache },
			'private, no-store',
		],
		['GET', {}, 500, { 'cache-control': publicCache }, 'private, no-store'],
		[
			'GET',
			{},
			302,
			{ 'cache-control': 'private, public' },
			'private, no-store',
		],
		[
			'GET',
			{},
			200,
			{ 'cache-control': publicCache, vary: 'Accept-Language' },
			'private, no-store',
		],
		[
			'GET',
			{},
			200,
			{ 'cache-control': publicCache, vary: '*' },
			'private, no-store',
		],
		[
			'GET',
			{},
			200,
			{ 'cache-control': publicCache, vary: 'Accept, Accept-Encoding' },
			publicCache,
		],
	]) {
		const response = protectCache(
			new Request('https://example.com', {
				method,
				headers: requestHeaders,
			}),
			new Response(null, { status, headers: responseHeaders })
		);
		assert.equal(response.headers.get('cache-control'), expected);
	}
});

test('HTTP API adapter preserves query, body, credentials, redirects and separate cookies', async () => {
	process.env.PUBLIC_ORIGIN = 'https://example.com';
	process.env.REMIX_ORIGIN_SECRET = 'test-secret';
	const handler = createLambdaHandler(async request => {
		assert.equal(
			request.url,
			'https://example.com/wiki?title=a%26b&tag=one&tag=two'
		);
		assert.equal(request.method, 'POST');
		assert.equal(request.headers.get('host'), 'example.com');
		assert.equal(request.headers.get('authorization'), 'Bearer user');
		assert.equal(request.headers.get('cookie'), 'session=one; other=two');
		assert.equal(request.headers.get('x-remix-origin-secret'), null);
		assert.deepEqual(
			Buffer.from(await request.arrayBuffer()),
			Buffer.from([0, 255, 128])
		);
		const headers = new Headers({ location: '/done' });
		headers.append('set-cookie', 'a=1; HttpOnly');
		headers.append('set-cookie', 'b=2; HttpOnly');
		return new Response('redirect', { status: 303, headers });
	});
	const event = {
		rawPath: '/wiki',
		rawQueryString: 'title=a%26b&tag=one&tag=two',
		requestContext: { http: { method: 'POST' } },
		headers: {
			host: 'gateway.invalid',
			authorization: 'Bearer user',
			'x-remix-origin-secret': 'test-secret',
		},
		cookies: ['session=one', 'other=two'],
		body: Buffer.from([0, 255, 128]).toString('base64'),
		isBase64Encoded: true,
	};
	const response = await handler(event);
	assert.equal(response.statusCode, 303);
	assert.equal(response.headers.location, '/done');
	assert.deepEqual(response.cookies, ['a=1; HttpOnly', 'b=2; HttpOnly']);
	assert.equal(response.headers['set-cookie'], undefined);
	assert.equal(Buffer.from(response.body, 'base64').toString(), 'redirect');
	assert.equal((await handler({ ...event, headers: {} })).statusCode, 403);
	assert.equal(
		(
			await handler({
				...event,
				headers: { 'x-remix-origin-secret': 'wrong' },
			})
		).statusCode,
		403
	);
});

test('immutable redirects can be marked private', () => {
	const response = protectCache(
		new Request('https://example.com'),
		Response.redirect('https://example.com/login', 302)
	);
	assert.equal(response.status, 302);
	assert.equal(response.headers.get('location'), 'https://example.com/login');
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
