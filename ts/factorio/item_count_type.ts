import { z } from 'zod/v4-mini';

import { Uint32 } from '#root/ts/factorio/uint32.js';

export const ItemCountType = Uint32;
export type ItemCountType = z.infer<typeof ItemCountType>;
