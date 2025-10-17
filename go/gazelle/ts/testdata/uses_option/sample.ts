import { expect } from '@jest/globals';

import { dep } from '#root/go/gazelle/ts/testdata/dependency/dep.js';

export const usesOption = (value: ReturnType<typeof dep>) => {
	expect(value).not.toBeNull();
	return value;
};
