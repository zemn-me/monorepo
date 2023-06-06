import classNames from 'classnames';
import React from 'react';

import style from './TimeEye.module.css';

export const TimeEye: React.FC<JSX.IntrinsicElements['svg']> = ({
	className,
	...props
}) => (
	<svg
		{...props}
		className={classNames(className, style['time-eye'])}
		viewBox="0 0 17.78 7.81"
	>
		<g transform="translate(-13.03 -62.53)">
			<path
				d="M16.73 62.66l-3.47 6.02h17.32l-3.47-6.02z"
				data-part="frustum"
				strokeWidth=".26"
			/>
			<circle
				cx="21.92"
				cy="65.47"
				data-part="iris"
				fill="none"
				r="1.61"
				strokeWidth=".16"
			/>
			<ellipse
				cx="21.92"
				cy="65.47"
				data-part="sclera"
				fill="none"
				rx="3.23"
				ry="1.58"
				strokeWidth=".23"
			/>
			<path
				d="M23.53 68.65a1.61 1.61 0 0 1-3.22 0c0-.9.72-1.2 1.61-1.62.9.42 1.61.73 1.61 1.62z"
				data-part="tear"
				strokeWidth=".16"
			/>
			<circle
				cx="21.92"
				cy="65.47"
				data-part="pupil"
				r=".54"
				strokeWidth=".08"
			/>
		</g>
	</svg>
);

export default TimeEye;
