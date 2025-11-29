import { useEffect, useState } from 'react';

import * as option from '#root/ts/option/types.js';

function useOrigin() {
	const [origin, setOrigin] = useState<option.Option<string>>(
		() => option.None
	);

	useEffect(
		() => {
			setOrigin(
				() => option.Some(window.location.origin)
			)
		}
	, [setOrigin])

	return origin
}

/**
 * Returns an absolute URL (as a string) for the given path using the current
 * window origin. Returns None during SSR or if the path is empty.
 */
export function useAbsolutePath(path: string): option.Option<string> {
	const origin = useOrigin();
	return option.and_then(
		origin,
		base => {
			const u = new URL(base);
			u.pathname = path;

			return u.toString();
		}
	)
}
