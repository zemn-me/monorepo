import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const html = readFileSync(
	'ts/pulumi/bowerybugle.nyc/public/index.html',
	'utf8'
);
const script = readFileSync(
	'ts/pulumi/bowerybugle.nyc/public/archive.js',
	'utf8'
);
const originalFetch = globalThis.fetch;
let published: boolean;
let loggedIn: boolean;
let failUpload: boolean;
const requests: { url: string; init?: RequestInit }[] = [];
const element = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T;
const reply = (data: unknown, status = 200) =>
	({ ok: status < 400, status, json: async () => data }) as Response;
const settle = async () => {
	for (let i = 0; i < 5; i++)
		await new Promise(resolve => setTimeout(resolve, 0));
};

beforeEach(() => {
	document.documentElement.innerHTML = html;
	history.replaceState(null, '', '/');
	published = false;
	loggedIn = false;
	failUpload = false;
	requests.length = 0;
	globalThis.fetch = jest
		.fn<typeof fetch>()
		.mockImplementation(async (url, init) => {
			requests.push({ url: String(url), ...(init ? { init } : {}) });
			switch (String(url)) {
				case '/api/issues':
					return reply({
						issues: Array.from({ length: 6 }, (_, index) => ({
							number: 6 - index,
							...(published && index === 0
								? { pdf: '/api/issues/6/pdf' }
								: {}),
						})),
					});
				case '/api/session':
					return reply({ authenticated: loggedIn });
				case '/api/login':
					return reply({ sent: true }, 202);
				case '/api/login/confirm':
					loggedIn = true;
					return reply({ authenticated: true });
				case '/api/logout':
					loggedIn = false;
					return reply({ authenticated: false });
				case '/api/uploads':
					return reply({
						id: 'upload-id',
						url: 'https://upload.example.test',
						fields: {
							key: 'issues/test.pdf',
							policy: 'signed-policy',
						},
					});
				case 'https://upload.example.test':
					return reply({}, failUpload ? 500 : 204);
				case '/api/uploads/upload-id/publish':
					published = true;
					return reply({ number: 6, pdf: '/api/issues/6/pdf' });
				default:
					throw new Error(`Unexpected request ${url}`);
			}
		});
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});
function start() {
	window.eval(script);
}
function submit(id: string) {
	element<HTMLFormElement>(id).dispatchEvent(
		new Event('submit', { bubbles: true, cancelable: true })
	);
}
function choosePDF() {
	Object.defineProperty(element('pdf'), 'files', {
		configurable: true,
		value: [
			new File(['%PDF-test'], 'issue-6.pdf', { type: 'application/pdf' }),
		],
	});
}

test('reader sees issues and opens author login only from the footer', async () => {
	start();
	await settle();
	expect(document.querySelectorAll('#issue-list li')).toHaveLength(6);
	expect(document.querySelectorAll('#issue-list a')).toHaveLength(0);
	expect(element('author-panel').hidden).toBe(true);
	element('show-login').click();
	expect(element('author-panel').hidden).toBe(false);
	expect(document.activeElement).toBe(element('email'));
	element<HTMLInputElement>('email').value = 'author@example.test';
	submit('login-form');
	await settle();
	expect(element('login-status').textContent).toContain(
		'login link is on its way'
	);
	expect(element('upload-panel').hidden).toBe(true);
});

test('email link requires confirmation, then author can publish, read and log out', async () => {
	history.replaceState(null, '', '/#login=secret-token');
	start();
	await settle();
	expect(location.hash).toBe('');
	expect(requests.some(r => r.url === '/api/login/confirm')).toBe(false);
	element('confirm-login').click();
	await settle();
	expect(
		JSON.parse(
			String(
				requests.find(r => r.url === '/api/login/confirm')?.init?.body
			)
		)
	).toEqual({ token: 'secret-token' });
	expect(element('upload-panel').hidden).toBe(false);
	choosePDF();
	submit('upload-form');
	await settle();
	expect(element('upload-status').textContent).toBe('Issue 6 is published.');
	expect(document.querySelector('#issue-list a')?.getAttribute('href')).toBe(
		'/api/issues/6/pdf'
	);
	expect(element('publish').textContent).toBe('Replace PDF');
	const upload = requests.find(r => r.url === 'https://upload.example.test');
	expect(upload?.init?.credentials).toBe('omit');
	const form = upload?.init?.body;
	if (!(form instanceof FormData)) throw new Error('Upload form missing');
	expect(form.get('file')).toBeInstanceOf(File);
	element('logout').click();
	await settle();
	expect(element('upload-panel').hidden).toBe(true);
	expect(element('show-login').hidden).toBe(false);
});

test('failed file upload never publishes and leaves the form usable for retry', async () => {
	loggedIn = true;
	failUpload = true;
	start();
	await settle();
	choosePDF();
	submit('upload-form');
	await settle();
	expect(requests.some(r => r.url.endsWith('/publish'))).toBe(false);
	expect(element('upload-status').textContent).toContain('upload failed');
	expect(element<HTMLButtonElement>('publish').disabled).toBe(false);
	expect(element<HTMLInputElement>('pdf').disabled).toBe(false);
	failUpload = false;
	submit('upload-form');
	await settle();
	expect(element('upload-status').textContent).toBe('Issue 6 is published.');
});

test('expired login link allows requesting another without showing upload controls', async () => {
	const fetch = globalThis.fetch;
	globalThis.fetch = jest
		.fn<typeof fetch>()
		.mockImplementation((url, init) =>
			String(url) === '/api/login/confirm'
				? Promise.resolve(
						reply({ error: 'This link has expired.' }, 400)
					)
				: fetch(url, init)
		);
	history.replaceState(null, '', '/#login=expired');
	start();
	await settle();
	element('confirm-login').click();
	await settle();
	expect(element('login-status').textContent).toContain('expired');
	expect(element('login-form').hidden).toBe(false);
	expect(element('upload-panel').hidden).toBe(true);
});
