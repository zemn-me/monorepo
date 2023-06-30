import style from 'project/zemn.me/next/components/line_divider/line_divider.module.css';
import type React from 'react';

export interface Props<
	P = any,
	T extends string | React.JSXElementConstructor<any> =
		| string
		| React.JSXElementConstructor<any>
> {
	children?: React.ReactElement<P, T>[];
}

export default function LineDivider<
	P = any,
	T extends string | React.JSXElementConstructor<any> =
		| string
		| React.JSXElementConstructor<any>
>(props: Props<P, T>) {
	return (
		<div className={style.lineDivider}>
			<div className={style.lineDividerContent}>{props.children}</div>
		</div>
	);
}
