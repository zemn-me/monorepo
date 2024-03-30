import { NextConfig } from 'next/types';

import * as mod from '#root/ts/next.js/next.config.js';

it('should be correct type', () => {
	const x: NextConfig = mod;
	expect(x).not.toBeUndefined();
});
