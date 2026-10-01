import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const server = path.resolve('project/me/zemn/server');
const { handleRequest, handler } = await import(
	pathToFileURL(path.join(server, 'handler.mjs')).href
);
const request = (route, options) =>
	handleRequest(new Request(`https://zemn.me${route}`, options));

test('production artifact serves prerendered HTML and navigation data', async () => {
	const home = await request('/');
	assert.equal(home.status, 200);
	assert.match(home.headers.get('cache-control'), /s-maxage=300/);
	assert.match(await home.text(), /Thomas/);
	const data = await request('/article.data');
	assert.equal(data.status, 200);
	assert.match(data.headers.get('content-type'), /text\/x-script/);
	assert.match(await data.text(), /Kasimir/);
	const head = await request('/article', { method: 'HEAD' });
	assert.equal(head.status, 200);
	assert.equal(await head.text(), '');
});

test('unprerendered routes and query-dependent loader requests reach the live router', async () => {
	await assert.rejects(access(path.join(server, 'prerendered/healthz.html')));
	await assert.rejects(access(path.join(server, 'prerendered/journal.html')));
	for (const route of [
		'/healthz',
		'/journal?wiki=all',
		'/article?refresh=1',
		'/article.data?_routes=app/article/page',
	]) {
		const response = await request(route);
		assert.equal(response.status, 200, route);
		assert.equal(
			response.headers.get('cache-control'),
			'private, no-store',
			route
		);
		assert.ok((await response.text()).length > 0);
	}
	for (const headers of [
		{ cookie: 'session=one' },
		{ authorization: 'Bearer two' },
	]) {
		const response = await request('/article', { headers });
		assert.equal(response.status, 200);
		assert.equal(
			response.headers.get('cache-control'),
			'private, no-store'
		);
	}
});

test('runtime errors preserve status and cannot be cached', async () => {
	const response = await request('/this-route-does-not-exist');
	assert.equal(response.status, 404);
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
	const post = await request('/article', { method: 'POST', body: 'test' });
	assert.equal(post.status, 405);
	assert.equal(post.headers.get('cache-control'), 'private, no-store');
});

test('the self-contained deployment artifact runs through the Lambda entry point', async () => {
	process.env.PUBLIC_ORIGIN = 'https://zemn.me';
	process.env.REMIX_ORIGIN_SECRET = 'integration-test-secret';
	const event = {
		rawPath: '/healthz',
		rawQueryString: '',
		headers: { 'x-remix-origin-secret': 'integration-test-secret' },
		requestContext: { http: { method: 'GET' } },
	};
	const response = await handler(event);
	assert.equal(response.statusCode, 200);
	assert.match(Buffer.from(response.body, 'base64').toString(), /OK/);
	assert.equal((await handler({ ...event, headers: {} })).statusCode, 403);
});
