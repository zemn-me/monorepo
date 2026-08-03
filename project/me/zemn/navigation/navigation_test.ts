import { expect, it } from '@jest/globals';

import {
	accountLinks,
	navSections,
	pageLinks,
} from '#root/project/me/zemn/navigation/navigation.js';

function allMenuHrefs(): string[] {
	return navSections.flatMap(section => section.links.map(link => link.href));
}

it('keeps menu hrefs unique', () => {
	const hrefs = allMenuHrefs();

	expect(new Set(hrefs).size).toBe(hrefs.length);
});

it('includes public index pages', () => {
	const hrefs = new Set(allMenuHrefs());
	const expected = ['/', '/article', '/experiments'];

	expect(expected.filter(href => !hrefs.has(href))).toEqual([]);
	expect(hrefs).not.toContain('/2026/endings');
	expect(hrefs).not.toContain('/bluesky');
	expect(hrefs).not.toContain('/github');
	expect(hrefs).not.toContain('/linkedin');
	expect(hrefs).not.toContain('/src');
	expect(hrefs).not.toContain('/twitter');
	expect(hrefs).not.toContain('/cv');
	expect(hrefs).not.toContain('/tool/elastictabs');
});

it('requires authentication for availability in the menu', () => {
	expect(pageLinks.find(link => link.href === '/availability')).toEqual(
		expect.objectContaining({
			requiresAuthentication: true,
		})
	);
});

it('uses one article index link instead of individual articles', () => {
	const articleHrefs = allMenuHrefs().filter(href => href.startsWith('/article'));

	expect(articleHrefs).toEqual(['/article']);
	expect(navSections.some(section => section.label === 'Articles')).toBe(false);
});

it('uses one experiment index link instead of individual experiments', () => {
	const experimentHrefs = allMenuHrefs().filter(href =>
		href.startsWith('/experiments')
	);

	expect(experimentHrefs).toEqual(['/experiments']);
	expect(navSections.some(section => section.label === 'Experiments')).toBe(
		false
	);
});

it('does not include a standalone tools menu section', () => {
	expect(navSections.some(section => section.label === 'Tools')).toBe(false);
});

it('keeps private pages scoped', () => {
	for (const link of accountLinks) {
		expect(link.requiredScope).toBeDefined();
	}
});
