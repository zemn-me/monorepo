import 'project/zemn.me/app/base.css';

import { Metadata } from 'next/types';
import { ReactNode } from 'react';
import { HeaderTagsAppRouter } from 'ts/next.js';

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link
					crossOrigin="anonymous"
					href="https://fonts.gstatic.com"
					rel="preconnect"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap"
					rel="stylesheet"
				/>
				<link href="/icon.svg" rel="icon" type="image/svg+xml" />
				<link
					href="/icon.svg"
					rel="apple-touch-icon"
					type="image/svg+xml"
				/>
				<HeaderTagsAppRouter />
			</head>
			<body>{children}</body>
		</html>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	metadataBase: new URL('https://zemn.me'),
	twitter: {
		creator: '@zemnmez',
	},
};
