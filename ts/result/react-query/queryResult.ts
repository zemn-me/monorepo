import { UseQueryResult } from "@tanstack/react-query";

import * as future from "#root/ts/result/react-query/future.js";



/**
 * Returns {@link None} if the query is still loading. Returns
 * {@link Some}({@Link Result}) if done loading.
 */
/*#__NO_SIDE_EFFECTS__*/ export function queryResult<T, E>(
	r: UseQueryResult<T, E>
): future.Future<T, E> {
	switch (r.status) {
	case "error":
		return future.error(r.error)
	case "pending":
		return future.pending()
	case "success":
		return future.success(r.data)
	}
}
