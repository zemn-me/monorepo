import { ZodSafeParseResult } from "zod";

import { Err, Ok, Result } from "#root/ts/result.js";


export function resultFromZod<I>(
	t: ZodSafeParseResult<I>
): Result<I> {
	if (t.success) return Ok(t.data);
	return Err(t.error);
}
