import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInThisContext } from 'node:vm';
import { afterAll, beforeAll, expect, test } from '@jest/globals';

// jsdom supplies the DOM; SSR and the API client need Node's real Fetch APIs.
Object.assign(
	globalThis,
	runInThisContext(
		'({ Request, Response, Headers, AbortSignal, AbortController, ReadableStream, WritableStream, TransformStream, setImmediate, clearImmediate })'
	)
);
const parse = (html: string) =>
	new DOMParser().parseFromString(html, 'text/html');

const directory = 'project/nyc/bowerybugle/build';
const {
	fetchPage,
	handler,
}: {
	fetchPage: (
		request: Request,
		context: { apiOrigin: string }
	) => Promise<Response>;
	handler: (event: unknown) => Promise<{
		statusCode: number;
		headers: Record<string, string>;
		body: string;
		isBase64Encoded: boolean;
	}>;
} = await import(
	pathToFileURL(
		path.resolve('project/nyc/bowerybugle/server_build/handler.mjs')
	).href
);
const originalFetch = globalThis.fetch;
let issues = [{ number: 6 }, { number: 5 }];
let unavailable = false;
let document: Document;
const render = (path = '/') =>
	fetchPage(new Request(`https://bowerybugle.nyc${path}`), {
		apiOrigin: 'https://api.bowerybugle.nyc',
	});
beforeAll(async () => {
	globalThis.fetch = async (input, init) => {
		const request = new Request(input, init);
		expect(request.url).toBe('https://api.bowerybugle.nyc/api/issues');
		expect(request.headers.get('cookie')).toBeNull();
		expect(request.headers.get('authorization')).toBeNull();
		expect(request.credentials).toBe('omit');
		return Response.json(
			unavailable ? { error: 'unavailable' } : { issues },
			{ status: unavailable ? 503 : 200 }
		);
	};
	const response = await render();
	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	document = parse(await response.text());
});
afterAll(() => {
	globalThis.fetch = originalFetch;
});

test('shows the masthead and a footer login without contact details', () => {
	expect(document.querySelectorAll('h1')).toHaveLength(1);
	expect(document.title).toBe('The Bowery Bugle');
	expect(
		document.querySelector('footer #show-login')?.getAttribute('href')
	).toBe('/manage');
	expect(document.querySelectorAll('form')).toHaveLength(0);
	expect(document.body.textContent).not.toContain('PDF not uploaded');
	expect(
		document.querySelector('[href^="mailto:"], [href^="tel:"]')
	).toBeNull();
	expect(document.body.textContent).not.toMatch(
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
	);
	expect(document.body.textContent).not.toMatch(
		/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/
	);
	expect(document.body.textContent).not.toContain('Henry Wong');
});

test('every local link and image resolves in the shipped site', async () => {
	const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
	expect(new Set(ids).size).toBe(ids.length);
	for (const element of document.querySelectorAll('[href], [src]')) {
		const target =
			element.getAttribute('href') ?? element.getAttribute('src');
		expect(target).toBeTruthy();
		const url = new URL(target ?? '', 'https://bowerybugle.nyc');
		if (url.origin !== 'https://bowerybugle.nyc') continue;
		if (url.hash) expect(ids).toContain(url.hash.slice(1));
		if (url.pathname.startsWith('/assets/'))
			expect(
				readFileSync(path.join(directory, url.pathname))
			).not.toHaveLength(0);
		else expect((await render(url.pathname)).status).toBe(200);
	}
});

test('does not publish the supplied photographs or links to them', () => {
	expect(document.querySelectorAll('img')).toHaveLength(0);
	expect(
		document.querySelector('[href*="/photos/"], [src*="/photos/"]')
	).toBeNull();
	expect(existsSync(path.join(directory, 'photos'))).toBe(false);
});

test('offers a way home from missing pages', async () => {
	const response = await render('/missing');
	expect(response.status).toBe(404);
	const notFound = parse(await response.text());
	expect(notFound.querySelector('a[href="/"]')).not.toBeNull();
	expect(notFound.title).toContain('Page not found');
});

test('initial HTML includes current issues and later requests see edits', async () => {
	expect(document.querySelectorAll('#issue-list li')).toHaveLength(2);
	expect(document.querySelector('#issue-6')).not.toBeNull();
	expect(document.body.textContent).not.toContain('Loading issues');
	issues = [{ number: 7 }];
	const next = parse(await (await render()).text());
	expect(next.querySelector('#issue-7')).not.toBeNull();
	expect(next.querySelector('#issue-6')).toBeNull();
});

test('Lambda adapter uses configured origins and keeps author credentials out of HTML', async () => {
	process.env.SITE_ORIGIN = 'https://bowerybugle.nyc';
	process.env.API_ORIGIN = 'https://api.bowerybugle.nyc';
	try {
		const response = await handler({
			rawPath: '/manage',
			rawQueryString: '',
			requestContext: { http: { method: 'GET' } },
			cookies: ['__Host-bugle-session=secret'],
			headers: { host: 'attacker.test', authorization: 'secret' },
		});
		expect(response.statusCode).toBe(200);
		expect(response.headers['cache-control']).toBe('no-store');
		const html = Buffer.from(response.body, 'base64').toString();
		expect(parse(html).querySelector('#issue-7')?.textContent).toBe('Issue 7');
		expect(html).not.toContain('attacker.test');
		expect(html).not.toContain('secret');
	} finally {
		delete process.env.SITE_ORIGIN;
		delete process.env.API_ORIGIN;
	}
});

test('API failure gives a retryable uncached error instead of a false empty archive', async () => {
	unavailable = true;
	try {
		const response = await render();
		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
		const page = parse(await response.text());
		expect(page.body.textContent).toContain('Please reload');
		expect(page.querySelector('#issue-list')).toBeNull();
	} finally {
		unavailable = false;
	}
});
