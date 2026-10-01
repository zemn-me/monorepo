import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@jest/globals';

const directory = 'ts/pulumi/bowerybugle.nyc/public';
const document = new DOMParser().parseFromString(
	readFileSync(path.join(directory, 'index.html'), 'utf8'),
	'text/html'
);

test('publishes issue 6 with readable stories and working contact links', () => {
	expect(document.querySelectorAll('h1')).toHaveLength(1);
	expect(document.title).toBe('The Bowery Bugle — Issue 6');
	for (const text of [
		'September 18, 2026',
		'Henry Wong:',
		'Glitters',
		'Chrystie’s',
	]) {
		expect(document.body.textContent).toContain(text);
	}
	for (const href of ['mailto:bowerybugle@gmail.com', 'tel:+19178306332']) {
		expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
	}
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

test('includes all four original photographs with accessible descriptions', () => {
	const images = [...document.querySelectorAll('img')];
	const sources = new Set(images.map(image => image.getAttribute('src')));
	expect(sources.size).toBe(4);
	for (const image of images) {
		expect(image.alt.length).toBeGreaterThan(0);
		expect(image.width).toBe(960);
		expect(image.height).toBe(1280);
		const bytes = readFileSync(
			path.join(directory, image.getAttribute('src') ?? '')
		);
		expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
	}
});

test('offers a way home from missing pages', () => {
	const notFound = new DOMParser().parseFromString(
		readFileSync(path.join(directory, '404.html'), 'utf8'),
		'text/html'
	);
	expect(notFound.querySelector('a[href="/"]')).not.toBeNull();
	expect(notFound.title).toContain('Page not found');
});
