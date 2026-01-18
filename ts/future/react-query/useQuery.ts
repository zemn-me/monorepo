import { UseQueryResult } from "@tanstack/react-query";

import { error, Future, future_flatten_then, loading, resolve } from "#root/ts/future/future.js";


export function useQueryFuture<Then, Error>(
	result: UseQueryResult<Then, Error>,
): Future<Then, void, Error> {
	switch (result.status) {
	case 'success':
		return resolve(result.data);
	case 'pending':
		return loading(undefined);
		case 'error':
			return error(result.error);
	}
}

export function useQueryFuture_flatten<
	T1, E1, L1, E2
	>(
	result: UseQueryResult<Future<T1, L1, E1>, E2>,
) {
	return future_flatten_then(
		useQueryFuture(result),
	)
}

