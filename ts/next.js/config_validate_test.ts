import { expect, it } from '@jest/globals';
import { NextConfig } from 'next/types';

import config from '#root/ts/next.js/next.config.js';

it('should be correct type', () => {
	const x: NextConfig = config;
	expect(x).not.toBeUndefined();
});
