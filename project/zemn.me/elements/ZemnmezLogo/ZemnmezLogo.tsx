import classes from 'classnames';
import React from 'react';

import style from 'project/zemn.me/elements/ZemnmezLogo/ZemnmezLogo.module.css';

export default ({
	className,
	children,
	...props
}: React.SVGProps<SVGSVGElement>) => (
	<svg
		className={classes(className, style.zemnmezLogo)}
		height="348"
		viewBox="0 0 446 348"
		width="446"
		{...props}
	>
		{children}
		<path d="M174 0L54 120l33 32L207 33 174 0zm98 0l-32 33 119 119 33-32L272 0zm-49 59L109 174l114 114 115-114L223 59zM33 141L0 174l33 33 33-33-33-33zm380 0l-32 33 32 33 33-33-33-33zM87 195l-33 33 120 120 33-33L87 195zm272 0L240 315l32 33 120-120-33-33z" />
	</svg>
);
