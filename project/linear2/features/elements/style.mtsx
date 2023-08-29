import classNames from 'classnames';
import React from 'react';

import style from './base.module.sass';

export const AmbientClass = React.createContext<boolean>(false);

export const Style: (props: {
	children: React.ReactElement<{ className?: string }>;
}) => React.ReactElement = ({ children }) => {
	const hasAmbientClass = React.useContext(AmbientClass);

	if (hasAmbientClass) return children;

	return (
		<AmbientClass.Provider value={true}>
			{React.cloneElement(children, {
				...children.props,
				className: classNames(children.props.className, style.linear),
			})}
		</AmbientClass.Provider>
	);
};

export const text: (props: { value: string }) => React.ReactElement = ({
	value,
}) => {
	const hasAmbientClass = React.useContext(AmbientClass);
	if (hasAmbientClass) return <>{value}</>;
	return (
		<AmbientClass.Provider value={true}>
			<span className={style.linear}>{value}</span>
		</AmbientClass.Provider>
	);
};
