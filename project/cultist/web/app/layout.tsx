import './base.css';

import type { Metadata } from 'next/types';
import type { ReactElement, ReactNode } from 'react';

export const metadata: Metadata = {
	title: 'Cultist Simulator',
	description: 'A playable Cultist Simulator browser implementation.',
};

export default function RootLayout({
	children,
}: Readonly<{ children: ReactNode }>): ReactElement {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
