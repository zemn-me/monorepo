import { z } from 'zod/v4-mini';

export const Int = z.number();
export type Int = z.infer<typeof Int>;
