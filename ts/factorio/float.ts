import { z } from 'zod';

export const Float = z.number();
export type Float = z.TypeOf<typeof Float>;
