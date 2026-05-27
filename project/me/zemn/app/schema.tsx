import { ReactNode } from 'react';

import {
	itemPropScope,
	itemScope,
} from '#root/ts/schema.org/schema.js';

export interface ProfilePageMicrodataProps {
	readonly children?: ReactNode;
}

export function ProfilePageMicrodata({
	children,
}: ProfilePageMicrodataProps) {
	return <div {...itemScope('ProfilePage')}>{children}</div>;
}

export function ProfilePageMainEntity({
	children,
}: ProfilePageMicrodataProps) {
	return (
		<header {...itemPropScope('ProfilePage', 'mainEntity', 'Person')}>
			{children}
		</header>
	);
}
