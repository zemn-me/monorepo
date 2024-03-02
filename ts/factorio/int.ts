import { z } from 'zod';

export const Int = z.number();
export type Int = z.TypeOf<typeof Int>;
