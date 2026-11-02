import { z } from 'zod';

import { Float } from '#root/ts/factorio/float.js';

const colour = Float.refine(n => n >= 0 && n <= 1, {
	message: 'colour must be between 0 and 1',
});

export const Color = z.strictObject({
	r: colour,
	g: colour,
	b: colour,
	a: colour,
});

export type Color = z.TypeOf<typeof Color>;
