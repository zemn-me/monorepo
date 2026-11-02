import { describe, expect, it } from '@jest/globals';

import { getMessage } from './basic.js';

describe('README example', () => {
	it('only returns allowlisted messages', () => {
		expect(getMessage('hello world')).toBe('hello world');
		expect(getMessage('helllo world!')).toBe(false);
	});
});
