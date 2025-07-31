import { z } from 'zod/v4-mini';

export const Uint = z
	.number()
	.check(z.refine(z => z >= 0, { message: 'uint must be >= 0' }));

export type Uint = z.infer<typeof Uint>;
