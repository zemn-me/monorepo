import { ReactNode } from 'react';

import Glade from '#root/project/me/zemn/components/Glade/glade.js';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return <Glade>{children}</Glade>;
}
