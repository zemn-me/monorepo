import { ReactNode } from 'react';

import Glade from '#root/project/me/zemn/components/Glade/glade.js';

export interface GladeLayoutProps {
	readonly children?: ReactNode;
}

export function GladeLayout({ children }: GladeLayoutProps) {
	return <Glade>{children}</Glade>;
}
