import { Future } from "#root/ts/future/future.js";
import * as Option from "#root/ts/option/types.js";

/**
 * Lossy function that converts a {@link Future} to an {@link Option}.
 *
 * Marked as deprecated because it's lossy.
 *
 * @deprecated please avoid using this function where possible.
 */
export function future_to_option<T>(
	fut: Future<T, unknown, unknown>,
): Option.Option<T> {
	return fut(
		value => Option.Some(value),
		() => Option.None,
		() => Option.None,
	)
}
