import Link from 'project/zemn.me/next/components/Link';
import { RootLayout } from 'project/zemn.me/next/layouts/root/root';
import React from 'react';

export interface Props {
	readonly children?: React.ReactNode;
}

export function ExperimentsLayout({ children }: Props) {
	return (
		<RootLayout>
			<nav>
				<Link href="/experiments/rays">rays</Link>
			</nav>
			{children}
		</RootLayout>
	);
}
