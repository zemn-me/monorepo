import { z } from 'zod/v4-mini';

import { Uint } from '#root/ts/factorio/uint';

export const Uint32 = Uint.check(z.refine(z => z < 0b11111111111111111111111111111111, {
	message: 'Uint32 must be less than Uint32_max',
}));
export type Uint32 = z.infer<typeof Uint32>;
