import { z } from 'zod';

import { Uint } from '#root/ts/factorio/uint.js';

export const Uint16 = Uint.refine(z => z < 0b1111111111111111, {
	message: 'Uint32 must be less than Uint32_max',
});
export type Uint16 = z.TypeOf<typeof Uint16>;
