import React from 'react';
import style from '//ts/react/element/time/time.module.css';
import classNames from 'classnames';

export const TimeEye: React.FC<JSX.IntrinsicElements['svg']> = ({
	className,
	...props
}) => (
	<svg
		{...props}
		className={classNames(className, style.sadIcon)}
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 17.78 7.81"
	>
		<g transform="translate(-13.03 -62.53)">
			<path
				className={style.frustum}
				strokeWidth=".26"
				d="M16.73 62.66l-3.47 6.02h17.32l-3.47-6.02z"
			/>
			<circle
				className={style.iris}
				cx="21.92"
				cy="65.47"
				r="1.61"
				fill="none"
				strokeWidth=".16"
			/>
			<ellipse
				className={style.sclera}
				cx="21.92"
				cy="65.47"
				fill="none"
				strokeWidth=".23"
				rx="3.23"
				ry="1.58"
			/>
			<path
				className={style.tear}
				strokeWidth=".16"
				d="M23.53 68.65a1.61 1.61 0 0 1-3.22 0c0-.9.72-1.2 1.61-1.62.9.42 1.61.73 1.61 1.62z"
			/>
			<circle
				className={style.pupil}
				cx="21.92"
				cy="65.47"
				r=".54"
				strokeWidth=".08"
			/>
		</g>
	</svg>
);

export default TimeEye;
