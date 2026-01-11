import { UseQueryResult } from "@tanstack/react-query";

import { error, Future, loading, resolve } from "#root/ts/future/future.js";


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

