import { expect, it } from '@jest/globals';

import {
	accountLinks,
	experimentLinks,
	navSections,
} from '#root/project/me/zemn/navigation/navigation.js';

function allMenuHrefs(): string[] {
	return navSections.flatMap(section => section.links.map(link => link.href));
}

it('keeps menu hrefs unique', () => {
	const hrefs = allMenuHrefs();

	expect(new Set(hrefs).size).toBe(hrefs.length);
});

it('includes the experiment route tree', () => {
	const hrefs = new Set(experimentLinks.map(link => link.href));
	const expected = [
		'/experiments',
		'/experiments/arena',
		'/experiments/article',
		'/experiments/cultist',
		'/experiments/emoji/flag',
		'/experiments/factorio',
		'/experiments/factorio/blueprint',
		'/experiments/factorio/blueprint/book',
		'/experiments/factorio/blueprint/parse',
		'/experiments/factorio/blueprint/request',
		'/experiments/factorio/blueprint/wall',
		'/experiments/frame',
		'/experiments/geometry_of_music',
		'/experiments/pitch_training',
		'/experiments/platonics',
		'/experiments/rays',
		'/experiments/toc',
	];

	expect(expected.filter(href => !hrefs.has(href))).toEqual([]);
});

it('includes public content and redirect pages', () => {
	const hrefs = new Set(allMenuHrefs());
	const expected = [
		'/',
		'/2026/endings',
		'/article',
		'/article/2014/csp',
		'/article/2019/cors',
		'/article/2020/icloud',
		'/article/2024/clean',
		'/article/2024/missing',
		'/availability',
		'/bluesky',
		'/cv',
		'/github',
		'/linkedin',
		'/src',
		'/tool/elastictabs',
		'/twitter',
	];

	expect(expected.filter(href => !hrefs.has(href))).toEqual([]);
});

it('keeps private pages scoped', () => {
	for (const link of accountLinks) {
		expect(link.requiredScope).toBeDefined();
	}
});
