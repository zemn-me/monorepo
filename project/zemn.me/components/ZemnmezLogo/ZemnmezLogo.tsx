import classes from 'classnames';
import React from 'react';

import style from '#root/project/zemn.me/components/ZemnmezLogo/ZemnmezLogo.module.css';

export default ({
	className,
	children,
	...props
}: React.SVGProps<SVGSVGElement>) => (
	<svg
		className={classes(className, style.zemnmezLogo)}
		height="348"
		role="img"
		viewBox="0 0 446 348"
		width="446"
		{...props}
	>
		<title lang="en-GB">Zemnmez Logo</title>
		<desc lang="en-GB">
			One big square, two small squares and 4 rectangles make up a shape
			that resembles a stylised, angular eye. A square, rotated 45° so
			that its corners point up, down, left and right. The square has on
			either side of it two similar smaller squares, separated by a small
			gap. Each of the four square's sides have a rectangle following
			their edges with the same small gap.
		</desc>
		{children}
		<path d="M174 0L54 120l33 32L207 33 174 0zm98 0l-32 33 119 119 33-32L272 0zm-49 59L109 174l114 114 115-114L223 59zM33 141L0 174l33 33 33-33-33-33zm380 0l-32 33 32 33 33-33-33-33zM87 195l-33 33 120 120 33-33L87 195zm272 0L240 315l32 33 120-120-33-33z" />
	</svg>
);
