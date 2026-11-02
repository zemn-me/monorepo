import { z } from 'zod';

export const Uint = z
	.number()
	.refine(z => z >= 0, { message: 'uint must be >= 0' });

export type Uint = z.TypeOf<typeof Uint>;
