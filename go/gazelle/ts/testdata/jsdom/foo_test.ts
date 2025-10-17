/**
 * @jest-environment jsdom
 */

import { expect, test } from '@jest/globals';

import { answer } from '#root/go/gazelle/ts/testdata/jsdom/foo.js';

test('answer uses jsdom', () => {
	const element = document.createElement('div');
	expect(element).not.toBeNull();
	expect(answer()).toBe(42);
});

