import { SafeParseReturnType, z, ZodError } from 'zod';

import { Err, Ok, Result } from '#root/ts/result.js';

export function zodUnsafe<T>() {
	return z.custom<T>(v => v);
}

export function resultFromZod<I, O>(
	t: SafeParseReturnType<I, O>
): Result<O, ZodError<I>> {
	if (t.success) return Ok(t.data);
	return Err(t.error);
}
