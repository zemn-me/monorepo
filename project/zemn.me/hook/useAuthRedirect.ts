import { useQuery } from "@tanstack/react-query";

import { is_some, Option, unwrap } from "#root/ts/option/types.js";
import { Err, Ok, Result } from "#root/ts/result/result.js";
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
export function useAuthRedirect(to: Option<URL>) {
	return useQuery({
		queryKey: ['useAuthRedirect', to.toString()],
		staleTime: 1* Hour,
		queryFn: async (): Promise<Result<string, UnableToOpenWindowError>> => {
			const wnd = window.open(unwrap(to), "_blank");
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
		enabled: is_some(to),
	})
}

