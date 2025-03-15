/**
 * @fileoverview small pip for showing progress.
 */

import { and_then as option_and_then, Option, unwrap_or as option_unwrap_or } from "#root/ts/option/types.js";
import { Result, result_and, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result/result.js";

export interface PendingPipProps {
	/**
	 * Represents a value which can be inexistant, loading, or in error.
	 *
	 * If the outer {@link Option} is {@link None}, then nothing is rendered.
	 *
	 * If the inner {@link Option} is {@link Some}, then the item is considered
	 * to be loading.
	 *
	 * If the inner {@link Result} is {@link Ok}, then nothing is rendered; but
	 * if it is {@link Err}, a little cross is shown which can be tapped on to
	 * see the error.
	 */
	value: Option<Option<Result<unknown, Error>>>
}

/**
 * Displays an icon for content that may error, or be loading.
 *
 * See {@link PendingPipProps["value"]} for states that may be displyed and how
 * to pass them.
 */
export function PendingPip(props: PendingPipProps) {
	return option_unwrap_or(
		option_and_then(
			props.value,
			v => option_unwrap_or(
				option_and_then(
					v,
					// content is loaded
					result => result_unwrap_or_else(
						result_and(
							result,
							<>✓</>
						),

						// loading failed
						err => <details>
							<summary>❌</summary>
							{err.toString()}
						</details>
					)
				),
				// if the inner option is None,
				// the content is loading.
				<>⏳</>
			)
		),
		// if the outer option is None, render
		// nothing,
		null
	)
}

