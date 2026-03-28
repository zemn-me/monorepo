import { describe, expect, test } from '@jest/globals';

import {
	isNodeHighlighted,
	matchesHighlightFilter,
	matchesSearchQuery,
	normaliseSearchQuery,
} from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/highlight.js';
import type { EntityNode } from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/types.js';

function buildNode(overrides: Partial<EntityNode> = {}): EntityNode {
	return {
		id: 'Q42',
		label: 'Douglas Adams',
		highlightFlags: {
			anglicanPriest: false,
			anyNobleTitle: false,
			living: false,
			politician: false,
			military: false,
			monarchNobleTitle: false,
			rightHonourable: false,
		},
		url: 'https://www.wikidata.org/wiki/Q42',
		...overrides,
	};
}

describe('highlight helpers', () => {
	test('normaliseSearchQuery trims and lowercases', () => {
		expect(normaliseSearchQuery('  Royal Navy  ')).toBe('royal navy');
	});

	test('matchesSearchQuery matches both label and id', () => {
		const node = buildNode();
		expect(matchesSearchQuery(node, 'douglas')).toBe(true);
		expect(matchesSearchQuery(node, 'q42')).toBe(true);
		expect(matchesSearchQuery(node, 'not-a-match')).toBe(false);
	});

	test('matchesHighlightFilter checks selected flag only', () => {
		const node = buildNode({
			highlightFlags: {
				...buildNode().highlightFlags,
				military: true,
			},
		});
		expect(matchesHighlightFilter(node, 'military')).toBe(true);
		expect(matchesHighlightFilter(node, 'politician')).toBe(false);
		expect(matchesHighlightFilter(node, 'none')).toBe(false);
	});

	test('isNodeHighlighted returns true for either filter or search match', () => {
		const highlightedNode = buildNode({
			highlightFlags: {
				...buildNode().highlightFlags,
				politician: true,
			},
		});
		expect(isNodeHighlighted(highlightedNode, 'politician', '')).toBe(true);
		expect(isNodeHighlighted(buildNode(), 'none', 'adams')).toBe(true);
		expect(isNodeHighlighted(buildNode(), 'none', 'nope')).toBe(false);
	});
});
