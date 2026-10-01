import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@jest/globals';

const directory = 'ts/pulumi/bowerybugle.nyc/public';
const document = new DOMParser().parseFromString(
	readFileSync(path.join(directory, 'index.html'), 'utf8'),
	'text/html'
);

test('shows the masthead, six issues and a footer login without contact details', () => {
	expect(document.querySelectorAll('h1')).toHaveLength(1);
	expect(document.title).toBe('The Bowery Bugle');
	expect(
		[...document.querySelectorAll('#issue-list h3')].map(e => e.textContent)
	).toEqual([
		'Issue 6',
		'Issue 5',
		'Issue 4',
		'Issue 3',
		'Issue 2',
		'Issue 1',
	]);
	expect(document.querySelector('footer #show-login')?.textContent).toBe(
		'Log in'
	);
	expect(
		document.querySelector('#upload-panel')?.hasAttribute('hidden')
	).toBe(true);
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

test('every local link and image resolves in the shipped site', () => {
	const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
	expect(new Set(ids).size).toBe(ids.length);
	for (const element of document.querySelectorAll('[href], [src]')) {
		const target =
			element.getAttribute('href') ?? element.getAttribute('src');
		expect(target).toBeTruthy();
		const url = new URL(target ?? '', 'https://bowerybugle.nyc');
		if (url.origin !== 'https://bowerybugle.nyc') continue;
		if (url.hash) expect(ids).toContain(url.hash.slice(1));
		if (url.pathname !== '/') {
			expect(
				readFileSync(path.join(directory, url.pathname))
			).not.toHaveLength(0);
		}
	}
});

test('does not publish the supplied photographs or links to them', () => {
	expect(document.querySelectorAll('img')).toHaveLength(0);
	expect(
		document.querySelector('[href*="/photos/"], [src*="/photos/"]')
	).toBeNull();
	expect(existsSync(path.join(directory, 'photos'))).toBe(false);
});

test('offers a way home from missing pages', () => {
	const notFound = new DOMParser().parseFromString(
		readFileSync(path.join(directory, '404.html'), 'utf8'),
		'text/html'
	);
	expect(notFound.querySelector('a[href="/"]')).not.toBeNull();
	expect(notFound.title).toContain('Page not found');
});
