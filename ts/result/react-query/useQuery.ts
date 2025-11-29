import { useQuery } from "@tanstack/react-query";

import * as future from "#root/ts/result/react-query/future.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";


type UseQueryParam<T, E> = future.Future<{
	fn: () => Promise<T>,
	key: string[],
	staleTime?: number,
}, E>

export function useFuture<T, E>(
	p: UseQueryParam<T, E>
) {
	const staleTime = future.unrap_or(
		future.and_then(
			p,
			p => p.staleTime
		),
		undefined
	)

	const r = queryResult(useQuery({
		queryFn: future.or_skip_query(
			future.and_then(p, p => p.fn)
		),
		queryKey: future.unrap_or(
			future.and_then(
				p,
				p => p.key
			)
			, [] as string[]), // undefined?
		staleTime
	}));

	return future.flatten(future.and_then(p,
		() => r
	))
}
