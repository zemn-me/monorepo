import React from 'react';
import { atom, useRecoilState } from 'recoil';

import { HeadingElement } from './headingsAndSections';

export const key = 'elements/headingsAndSections/outline';

export interface Root {
	children: Set<Node>;
	element: never;
}

export interface Node {
	element: HeadingElement;
	parent: Node | Root;
	children: Set<Node>;
}

export const state = atom<Root>({
	key,
	default: { children: new Set(), ISROOT: true } as any,
});

const parentCtx = React.createContext<Root | Node | undefined>(undefined);

export const Provide: React.FC<{ element: HeadingElement }> = ({
	element,
	children,
}) => {
	return <> {children} </>;
	const [rootState, setRootState] = useRecoilState(state);
	const trueParent = React.useContext(parentCtx);
	const parent = trueParent ?? rootState;
	const node: Node = { element, parent, children: new Set() };

	React.useEffect(() => {
		parent.children.add(node);
		setRootState({ ...rootState });
		return () => {
			parent.children.delete(node);
			setRootState({ ...rootState });
		};
	}, [setRootState]);

	return (
		<parentCtx.Provider value={trueParent !== undefined ? node : rootState}>
			{children}
		</parentCtx.Provider>
	);
};
