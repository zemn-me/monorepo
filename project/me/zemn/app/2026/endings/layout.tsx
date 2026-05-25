import '#root/project/endings/app/base.css';

import { ReactNode } from 'react';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return children;
}
