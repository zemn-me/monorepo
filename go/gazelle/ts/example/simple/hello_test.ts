import { expect, test } from '@jest/globals';

import { hello } from './hello.js';

test('hello', () => {
    expect(hello).toBe('world');
});
