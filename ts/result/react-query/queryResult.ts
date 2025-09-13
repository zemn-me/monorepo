import { UseQueryResult } from "@tanstack/react-query";

import { None, Option, Some } from "#root/ts/option/types.js";
import { Err, Ok, Result } from "#root/ts/result/result.js";

/**
 * Returns {@link None} if the query is still loading. Returns
 * {@link Some}({@Link Result}) if done loading.
 */
/*#__NO_SIDE_EFFECTS__*/ export function queryResult<T, E>(
	r: UseQueryResult<T, E>
): Option<Result<T, E>> {
	switch (r.status) {
	case "error":
		return Some(Err(r.error))
	case "pending":
		return None
	case "success":
		return Some(Ok(r.data))
	}
}
