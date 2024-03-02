import { z } from 'zod';

import { Uint } from '#root/ts/factorio/uint';

export const Uint16 = Uint.refine(z => z > 0 && z < 0b1111111111111111, {
	message: 'Uint32 must be greater than zero and less than Uint32_max',
});
export type Uint16 = z.TypeOf<typeof Uint16>;
