import { expect, test } from '@jest/globals';

import { hello } from '#root/go/gazelle/ts/example/simple/hello.js';

test('hello', () => {
    expect(hello).toBe('world');
});
