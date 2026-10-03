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

const wikiID = '00000000-0000-4000-8000-000000000001';
const makeToken = (sub, exp = Math.floor(Date.now() / 1000) + 3600) =>
	`${Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
		JSON.stringify({
			iss: 'https://api.zemn.me',
			aud: 'zemn.me',
			sub,
			jti: `session-${sub}`,
			iat: Math.floor(Date.now() / 1000),
			exp,
		})
	).toString('base64url')}.test-signature`;

function fakeAPI(t, subjects = ['alice', 'bob', 'restricted']) {
	const tokens = new Map(subjects.map(sub => [makeToken(sub), sub]));
	const calls = [];
	t.mock.method(globalThis, 'fetch', async request => {
		assert.equal(new URL(request.url).origin, 'https://api.zemn.me');
		assert.equal(request.cache, 'no-store');
		const sub = tokens.get(request.headers.get('authorization'));
		const route = new URL(request.url).pathname;
		calls.push({ sub, route });
		// Models the API's signature verification: parsed claims alone grant nothing.
		if (!sub) return Response.json({}, { status: 401 });
		if (route === '/me/scopes')
			return Response.json({
				scopes: sub === 'restricted' ? [] : ['journal_read'],
			});
		const page = {
			id: wikiID,
			title: `${sub}'s private wiki`,
			kind: 'project',
			aliases: [],
			blocks: [],
		};
		if (route === '/journal')
			return Response.json({
				entries: [],
				summaries: [],
				wiki: [page],
				curation: { status: 'ready', generation: sub },
			});
		if (route === `/journal/wiki/${wikiID}`) return Response.json(page);
		assert.fail(`Unexpected API call ${route}`);
	});
	return { tokens, calls };
}

async function loginCookie(token) {
	const response = await request('/auth/session', {
		method: 'POST',
		headers: { Origin: 'https://zemn.me', Authorization: token },
	});
	assert.equal(response.status, 204);
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
	const cookie = response.headers.get('set-cookie');
	assert.match(cookie, /^__Host-zemn-authorization=/);
	for (const attribute of [
		'HttpOnly',
		'Secure',
		'SameSite=Lax',
		'Path=/',
		'Expires=',
	])
		assert.ok(cookie.includes(attribute), attribute);
	assert.doesNotMatch(cookie, /Domain=/i);
	return cookie.split(';')[0];
}

function assertPrivate(response) {
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
	assert.match(response.headers.get('vary'), /cookie/i);
	assert.match(response.headers.get('vary'), /authorization/i);
}

test('authenticated HTML and navigation data are rendered per request without serializing credentials', async t => {
	const { tokens } = fakeAPI(t);
	const sessions = await Promise.all(
		[...tokens].slice(0, 2).map(async ([token, sub]) => ({
			token,
			sub,
			cookie: await loginCookie(token),
		}))
	);
	// A warm renderer must isolate overlapping requests and later requests too.
	for (let round = 0; round < 2; round++) {
		await Promise.all(
			sessions.map(async ({ token, sub, cookie }) => {
				for (const route of [
					'/journal?wiki=all',
					`/journal?wiki=${wikiID}`,
					'/journal.data?wiki=all',
				]) {
					const response = await request(route, {
						headers: { cookie },
					});
					assertPrivate(response);
					const body = await response.text();
					assert.ok(
						body.includes(`${sub}&#x27;s private wiki`) ||
							body.includes(`${sub}'s private wiki`),
						route
					);
					assert.ok(
						!body.includes(token),
						'credential must never enter HTML or dehydrated data'
					);
					assert.ok(
						!body.includes(sub === 'alice' ? 'bob' : 'alice'),
						'another account leaked'
					);
					if (!route.includes('.data')) {
						assert.match(body, /aria-label="Diary wiki"/);
						assert.doesNotMatch(
							body,
							/aria-label="Loading (journal|wiki page)"/
						);
					}
				}
			})
		);
	}
	const anonymous = await request('/journal?wiki=all');
	assertPrivate(anonymous);
	const body = await anonymous.text();
	assert.doesNotMatch(body, /private wiki|aria-label="Diary wiki"/);
});

test('invalid, expired, and unprivileged cookies cannot render a journal', async t => {
	const { tokens, calls } = fakeAPI(t);
	const restricted = [...tokens].find(([, sub]) => sub === 'restricted')[0];
	const cookies = [
		await loginCookie(restricted),
		`__Host-zemn-authorization=${encodeURIComponent(Buffer.from(JSON.stringify(makeToken('forged'))).toString('base64'))}`,
		`__Host-zemn-authorization=${encodeURIComponent(Buffer.from(JSON.stringify(makeToken('alice', 1))).toString('base64'))}`,
		'__Host-zemn-authorization=malformed',
	];
	for (const cookie of cookies) {
		const response = await request('/journal?wiki=all', {
			headers: { cookie },
		});
		assertPrivate(response);
		assert.doesNotMatch(
			await response.text(),
			/private wiki|aria-label="Diary wiki"/
		);
	}
	assert.ok(!calls.some(call => call.route === '/journal'));
	const rejected = await request('/auth/session', {
		method: 'POST',
		headers: {
			Origin: 'https://zemn.me',
			Authorization: makeToken('forged'),
		},
	});
	assert.equal(rejected.status, 401);
	assert.equal(rejected.headers.get('set-cookie'), null);
});

test('session updates require same origin and logout expires the host cookie', async t => {
	const { tokens } = fakeAPI(t);
	const token = tokens.keys().next().value;
	for (const method of ['POST', 'DELETE']) {
		for (const origin of [
			undefined,
			'https://evil.example',
			'https://other.zemn.me',
		]) {
			const response = await request('/auth/session', {
				method,
				headers: {
					Authorization: token,
					...(origin ? { Origin: origin } : {}),
				},
			});
			assert.equal(response.status, 403);
			assert.equal(response.headers.get('set-cookie'), null);
		}
	}
	const response = await request('/auth/session', {
		method: 'DELETE',
		headers: { Origin: 'https://zemn.me' },
	});
	assert.equal(response.status, 204);
	assert.match(
		response.headers.get('set-cookie'),
		/^__Host-zemn-authorization=.*Max-Age=0/
	);
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
