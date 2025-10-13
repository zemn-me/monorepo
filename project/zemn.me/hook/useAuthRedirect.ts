import { useQuery } from "@tanstack/react-query";

import { and_then as option_and_then, flatten as option_flatten, is_some, Option, option_result_and_then, result_to_option, unwrap as unwrap_option } from "#root/ts/option/types.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { Err, flatten as result_flatten, is_ok, Ok, Result, result_and, unwrap as unwrap_result } from "#root/ts/result/result.js";
import { Hour } from "#root/ts/time/duration.js";


class UnableToOpenWindowError extends Error {
	constructor() {
		super('unable to open window')
	}
}

/**
 * Opens a window to the {@link to} parameter, expecting that
 * window to return its params
 * (see code in project/zemn.me/app/auth/client.tsx).
 *
 * The window is automatically closed once we get its params.
 */
export function useAuthRedirect<T>(to: Option<Result<URL, T>>) {
	return option_and_then(queryResult(useQuery({
		queryKey: ['useAuthRedirect', to.toString()],
		staleTime: 1* Hour,
		queryFn: async (): Promise<Result<string, UnableToOpenWindowError>> => {
			const v = unwrap_result(unwrap_option(to));
			const wnd = window.open(v, "_blank");
			if (!wnd) return Err(new UnableToOpenWindowError());

			return new Promise<Result<string, never>>(ok => {
				function cb(e: MessageEvent) {
					if (e.origin != location.origin) return;
					ok( Ok(e.data));
					window.removeEventListener('message', cb)
				}

				window.addEventListener('message', cb);
			})
		},
		enabled: is_ok(option_flatten(option_and_then(
			to,
			result => result_to_option(result)
		)))
	})), result => result_flatten(result))
}

