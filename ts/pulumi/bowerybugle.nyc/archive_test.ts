import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const directory = 'ts/pulumi/bowerybugle.nyc/public/';
const script = readFileSync(`${directory}archive.js`, 'utf8');
const originalFetch = globalThis.fetch;
let issues: { number: number; pdf?: string }[];
let loggedIn: boolean;
let failUpload: boolean;
let uploadNumber: number;
const requests: { url: string; init?: RequestInit }[] = [];
const element = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T;
const reply = (data: unknown, status = 200) =>
	({ ok: status < 400, status, json: async () => data }) as Response;
const settle = async () => {
	for (let i = 0; i < 5; i++)
		await new Promise(resolve => setTimeout(resolve, 0));
};
function start(manage = true, hash = '') {
	document.documentElement.innerHTML = readFileSync(
		`${directory}${manage ? 'manage' : 'index'}.html`,
		'utf8'
	);
	history.replaceState(null, '', `${manage ? '/manage.html' : '/'}${hash}`);
	window.eval(script);
}
function submit(form: HTMLFormElement) {
	form.dispatchEvent(
		new Event('submit', { bubbles: true, cancelable: true })
	);
}
function row(number = 6) {
	return element(`issue-${number}`);
}
function control(text: string, number = 6) {
	const node = [...row(number).querySelectorAll('button')].find(
		button => button.textContent === text
	);
	if (!node) throw new Error(`Missing button ${text}`);
	return node;
}
function choosePDF(number = 6) {
	Object.defineProperty(element(`pdf-${number}`), 'files', {
		configurable: true,
		value: [
			new File(['%PDF-test'], `issue-${number}.pdf`, {
				type: 'application/pdf',
			}),
		],
	});
}
beforeEach(() => {
	issues = Array.from({ length: 6 }, (_, i) => ({ number: 6 - i }));
	loggedIn = false;
	failUpload = false;
	uploadNumber = 6;
	requests.length = 0;
	globalThis.fetch = jest
		.fn<typeof fetch>()
		.mockImplementation(async (url, init) => {
			const path = String(url);
			requests.push({ url: path, ...(init ? { init } : {}) });
			const body =
				init?.body && typeof init.body === 'string'
					? JSON.parse(init.body)
					: {};
			if (path === '/api/issues') {
				if (init?.method === 'POST') {
					if (issues.some(i => i.number === body.number))
						return reply(
							{ error: 'That issue already exists.' },
							409
						);
					issues.unshift({ number: body.number });
				}
				return reply({
					issues: [...issues].sort((a, b) => b.number - a.number),
				});
			}
			const match = path.match(/^\/api\/issues\/(\d+)(\/pdf)?$/);
			if (match && init?.method === 'DELETE') {
				if (match[2]) {
					const issue = issues.find(
						i => i.number === Number(match[1])
					);
					if (issue) delete issue.pdf;
				} else
					issues = issues.filter(i => i.number !== Number(match[1]));
				return reply({ saved: true });
			}
			switch (path) {
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
					uploadNumber = body.number;
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
				case '/api/uploads/upload-id/publish': {
					const issue = issues.find(i => i.number === uploadNumber);
					if (issue) issue.pdf = `/api/issues/${uploadNumber}/pdf`;
					return reply(issue);
				}
				default:
					throw new Error(`Unexpected request ${url}`);
			}
		});
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test('public page has blank missing links, Read links, and a separate management page', async () => {
	issues[0] = { number: 6, pdf: '/api/issues/6/pdf' };
	start(false);
	await settle();
	expect(document.querySelectorAll('#issue-list li')).toHaveLength(6);
	expect(row().querySelector('a')?.textContent).toBe('Read');
	expect(row(5).textContent).toBe('Issue 5');
	expect(element('show-login').getAttribute('href')).toBe('/manage.html');
	expect(document.querySelectorAll('form, .issue-controls')).toHaveLength(0);
	expect(requests.some(r => r.url === '/api/session')).toBe(false);
});

test('management renders exactly the same public row component with added author controls', async () => {
	issues[0] = { number: 6, pdf: '/api/issues/6/pdf' };
	start(false);
	await settle();
	const publicRows = [...document.querySelectorAll('.issue-line')].map(
		r => r.outerHTML
	);
	loggedIn = true;
	start();
	await settle();
	expect(
		[...document.querySelectorAll('.issue-line')].map(r => r.outerHTML)
	).toEqual(publicRows);
	expect(document.querySelectorAll('.issue-controls')).toHaveLength(6);
});

test('email login requires confirmation before editing and logout hides all controls', async () => {
	start();
	await settle();
	expect(document.querySelectorAll('.issue-controls')).toHaveLength(0);
	element<HTMLInputElement>('email').value = 'author@example.test';
	submit(element('login-form'));
	await settle();
	expect(element('login-status').textContent).toContain('12-hour');
	start(true, '#login=secret-token');
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
	expect(document.querySelectorAll('.issue-controls')).toHaveLength(6);
	element('logout').click();
	await settle();
	expect(document.querySelectorAll('.issue-controls')).toHaveLength(0);
	expect(element('add-issue').hidden).toBe(true);
	expect(element('author-panel').hidden).toBe(false);
});

test('author adds an issue, uploads, removes just its PDF, and deletes its row', async () => {
	loggedIn = true;
	start();
	await settle();
	element<HTMLInputElement>('issue-number').value = '7';
	submit(element('add-issue'));
	await settle();
	expect(document.querySelector('#issue-list h3')?.textContent).toBe(
		'Issue 7'
	);
	choosePDF(7);
	submit(row(7).querySelector('form') as HTMLFormElement);
	await settle();
	expect(element('edit-status').textContent).toBe('Issue 7 is published.');
	expect(row(7).querySelector('a')?.getAttribute('href')).toBe(
		'/api/issues/7/pdf'
	);
	expect(control('Replace PDF', 7)).toBeTruthy();
	const upload = requests.find(r => r.url === 'https://upload.example.test');
	expect(upload?.init?.credentials).toBe('omit');
	const form = upload?.init?.body;
	if (!(form instanceof FormData)) throw new Error('Upload form missing');
	expect(form.get('file')).toBeInstanceOf(File);
	control('Remove PDF', 7).click();
	await settle();
	expect(row(7).querySelector('a')).toBeNull();
	expect(row(7).querySelector('h3')?.textContent).toBe('Issue 7');
	control('Delete issue', 7).click();
	await settle();
	expect(row(7)).toBeNull();
	start(false);
	await settle();
	expect(row(7)).toBeNull();
	expect(document.querySelectorAll('#issue-list li')).toHaveLength(6);
});

test('failed upload preserves the current PDF and selection for retry', async () => {
	loggedIn = true;
	failUpload = true;
	issues[0] = { number: 6, pdf: '/api/issues/6/pdf' };
	start();
	await settle();
	choosePDF();
	submit(row().querySelector('form') as HTMLFormElement);
	await settle();
	expect(requests.some(r => r.url.endsWith('/publish'))).toBe(false);
	expect(element('edit-status').textContent).toContain('upload failed');
	expect(row().querySelector('a')).not.toBeNull();
	expect(control('Replace PDF').disabled).toBe(false);
	expect(element<HTMLInputElement>('pdf-6').disabled).toBe(false);
	failUpload = false;
	submit(row().querySelector('form') as HTMLFormElement);
	await settle();
	expect(element('edit-status').textContent).toBe('Issue 6 is published.');
});

test('a rejected deletion keeps the issue visible and re-enables controls', async () => {
	loggedIn = true;
	start();
	await settle();
	const fetch = globalThis.fetch;
	globalThis.fetch = jest
		.fn<typeof fetch>()
		.mockImplementation((url, init) =>
			init?.method === 'DELETE'
				? Promise.resolve(reply({ error: 'Please log in again.' }, 401))
				: fetch(url, init)
		);
	control('Delete issue').click();
	await settle();
	expect(row()).not.toBeNull();
	expect(control('Delete issue').disabled).toBe(false);
	expect(element('edit-status').textContent).toBe('Please log in again.');
});

test('expired login link offers another email without exposing editing controls', async () => {
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
	start(true, '#login=expired');
	await settle();
	element('confirm-login').click();
	await settle();
	expect(element('login-status').textContent).toContain('expired');
	expect(element('login-form').hidden).toBe(false);
	expect(document.querySelectorAll('.issue-controls')).toHaveLength(0);
});
