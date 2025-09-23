import { z } from 'zod/v4-mini';

import { Uint } from '#root/ts/factorio/uint';

export const Uint16 = Uint.check(z.refine(z => z < 0b1111111111111111, {
	message: 'Uint32 must be less than Uint32_max',
}));
export type Uint16 = z.infer<typeof Uint16>;
