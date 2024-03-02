import { z } from 'zod';

export const OneBasedIndex = z.number().refine(v => v != 0, {
	message: '1-based index',
});
