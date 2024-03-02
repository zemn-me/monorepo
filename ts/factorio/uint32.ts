import { z } from 'zod';

import { Uint } from '#root/ts/factorio/uint';

export const Uint32 = Uint.refine(
	z => z > 0 && z < 0b11111111111111111111111111111111,
	{
		message: 'Uint32 must be greater than zero and less than Uint32_max',
	}
);
export type Uint32 = z.TypeOf<typeof Uint32>;
