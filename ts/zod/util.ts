import b64 from 'base64-js';
import { z, ZodError, ZodSafeParseResult } from 'zod';

import { Err, Ok, Result } from '#root/ts/result_types.js';

export function zodUnsafe<T>() {
	return z.custom<T>(v => v);
}

export function resultFromZod<I>(
	t: ZodSafeParseResult<I>
): Result<I, ZodError<I>> {
	if (t.success) return Ok(t.data);
	return Err(t.error);
}

export const Base64 = z.string()
	.base64()
	.transform(v => b64.toByteArray(v));
