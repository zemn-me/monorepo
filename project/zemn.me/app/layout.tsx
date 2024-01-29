import 'project/zemn.me/app/base.css';

import { Metadata } from 'next/types';
import { ReactNode } from 'react';

import { Providers } from '#root/project/zemn.me/app/providers.js';
import { Bio } from '#root/project/zemn.me/bio/index.js';
import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';
import { text } from '#root/ts/react/lang/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<Providers>
			<html>
				<head>
					<link
						href="https://fonts.googleapis.com"
						rel="preconnect"
					/>
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
		</Providers>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	themeColor: [
		{ media: '(prefers-color-scheme: dark)', color: '#010' },
		{ media: '(prefers-color-scheme: light)', color: '#fff' },
	],
	authors: [{ name: text(Bio.who.fullName), url: 'https://zemn.me' }],
	metadataBase: new URL('https://zemn.me'),
	twitter: {
		creator: '@zemnmez',
	},
	// fairly sure I do these manually.
	// not sure about date and address -- are these
	// the <datetime> and <addr> tags?
	formatDetection: {
		telephone: false,
		email: false,
		url: false,
	},
};
