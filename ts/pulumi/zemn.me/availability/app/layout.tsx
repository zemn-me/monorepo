import 'ts/pulumi/zemn.me/availability/app/base.css';

import { Metadata } from 'next/types';
import { ReactNode } from 'react';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
} from '#root/ts/next.js/index.js';

export interface Props {
	readonly children?: ReactNode;
}

const cspPolicy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'object-src': new Set(['https://calendar.google.com']),
};

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<HeaderTagsAppRouter cspPolicy={cspPolicy} />
			</head>
			<body>{children}</body>
		</html>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	title: 'Thomas’ Availability',
	authors: [{ name: 'zemnmez' }],
	twitter: {
		site: '@zemnmez',
		creator: '@zemnnmez',
	},
};

export const viewport = {
	width: 'device-width',
	initialScale: 1,
};
