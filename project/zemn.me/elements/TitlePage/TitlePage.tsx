import React from 'react';
import style from './TitlePage.module.css';
import classes from 'classnames';
import TimeEye from 'project/zemn.me/elements/TimeEye';

export const Self: React.FC<
	React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	>
> = ({ className, ...props }) => (
	<div className={classes(className, style.titlepage)} {...props}>
		<TimeEye className={style.logo} />
	</div>
);

export default Self;
