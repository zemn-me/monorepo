import { skipToken } from "@tanstack/react-query";

import * as option from '#root/ts/option/types.js';

/**
 * returns {@link skipToken} if None.
 *
 * (necessary because {@link skipToken} is a unique
 * symbol which gets upcast to symbol when put in
 * a mutable context)
 */
export function option_or_skip_query<T>(
	o: option.Option<T>
): T | typeof skipToken {
	return option.unwrap_or(
		o, skipToken
	)
}
