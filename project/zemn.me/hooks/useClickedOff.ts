import React from 'react';
import { some, walk } from '#monorepo/ts/iter/index.js';

/**
 * useClickedOff sets up an event handler for if a click happened *not* on
 * the target element.
 *
 * @param onClickedOff The event. Can be null or undefined, which stops any
 * checks from happening.
 */
export const useClickedOff = (
	nodes?: Node[] | null,
	onClickedOff?: ((ev: MouseEvent) => void) | null
) => {
	const windowClickEvent = React.useCallback(
		(ev: MouseEvent) => {
			if (!onClickedOff || !nodes || nodes.length === 0) return;

			// if our node is in the bubble chain, ignore
			// the event.
			if (
				some(
					walk(ev.target as Node, v => {
						if (!(v instanceof Node) || v.parentNode == null)
							return [];
						return [v.parentNode];
					}),
					e => nodes.some(nd => nd === e)
				)
			)
				return;

			// otherwise, execute the callback
			onClickedOff(ev);
		},
		[onClickedOff, nodes]
	);

	React.useEffect(() => {
		window.addEventListener('click', windowClickEvent);
		return () => window.removeEventListener('click', windowClickEvent);
	}, [windowClickEvent]);
};

export default useClickedOff;
