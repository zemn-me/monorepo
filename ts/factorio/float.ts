import { z } from 'zod/v4-mini';

export const Float = z.number();
export type Float = z.infer<typeof Float>;
