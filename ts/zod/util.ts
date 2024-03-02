import { z } from 'zod';

export function zodUnsafe<T>() {
	return z.custom<T>(v => v);
}
