import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

import './style.css';

export const metadata: Metadata = {
	title: 'WAXING INCANDESCENT',
};

export default function Layout({ children }: { readonly children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<HeaderTagsAppRouter />
				{children}
			</body>
		</html>
	);
}
