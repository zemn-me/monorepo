import * as React from 'react';

interface Props {
	readonly children?: React.ReactNode;
	/**
	 * Use a single quote.
	 *
	 * The HTML spec explicitly forbids using the <Q>
	 * element for single quotes so it becomes a fragment.
	 *
	 * @see https://html.spec.whatwg.org/#the-q-element
	 */
	readonly single?: boolean;
}

export function Q(props: Props) {
	if (props.single) {
		return <>‘{props.children}’</>;
	}

	return <q>{props.children}</q>;
}
