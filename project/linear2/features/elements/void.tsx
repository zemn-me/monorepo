import React from 'react';

/**
 * Include an element *only* if it has properties, otherwise,
 * include just its children. Properties provided directly to the
 * child are included on render, but not counted as far as Void
 * is concerned. If a property is set to 'undefined', it is assumed
 * to be unset.
 *
 * @example
 * // this evaluates to just 'hello world!'
 * <Void>
 *  <span>hello world!</span>
 * </Void>
 * @example
 * // this evaluates to <span class="ok">hello world!</span>
 * <Void className="ok">
 *  <span>hello world!</span>
 * </Void>
 * @example
 * // attributes provided *directly* to the child
 * // are not counted as far as Void is concerned,
 * // so this is just 'hello world'.
 * <Void>
 *  <span className="ok">hello world!</span>
 * </Void>
 * // but this is <span className="ok" lang="en">hello world!</span>
 * <Void lang="en">
 *  <span className="ok">hello world!</span>
 * </Void>
 */
export const Void: <T>(
	props: T & {
		children: React.ReactElement<T & { children?: React.ReactElement }>;
	}
) => React.ReactElement | null = ({ children, ...props }) => {
	if (
		Object.values(props).filter(
			<T, >(v: T | undefined): v is T => v != undefined
		).length == 0
	)
		return children.props.children ?? null;

	return React.cloneElement(children, { ...children.props, ...props });
};

export default Void;
