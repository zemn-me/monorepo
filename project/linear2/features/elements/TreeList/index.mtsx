import React from 'react';

import style from './style.module.sass';

export interface Node {
	value?: React.ReactElement;
	children?: Node[];
}

export type Props = Node;

export const Tree: (props: Props) => React.ReactElement = ({
	value,
	children,
}) => (
	<section className={style.Tree}>
		<header>{value}</header>
		<div className={style.Content}>
			{children?.map(child => {
				if (!child.children) return <span>{child.value}</span> ?? null;
				return <Tree {...child} />;
			}) ?? null}
		</div>
	</section>
);

export default Tree;
