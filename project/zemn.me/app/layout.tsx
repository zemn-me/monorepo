
import 'project/zemn.me/app/base.css';

import { Lora } from 'next/font/google';
import { Metadata } from 'next/types';
import { ReactNode } from 'react';
import z from 'zod';

import { Providers } from '#root/project/zemn.me/app/providers.js';
import { Bio } from '#root/project/zemn.me/bio/index.js';
import Glade from '#root/project/zemn.me/components/Glade/glade.js';
import { ZEMN_ME_API_BASE } from '#root/project/zemn.me/constants/constants.js';
import { DefaultContentSecurityPolicy, HeaderTagsAppRouter, SourceExpression } from '#root/ts/next.js/index.js';
import { text } from '#root/ts/react/lang/index.js';

export interface Props {
	readonly children?: ReactNode;
}

// prevents CSP errors. maybe i will just have to move to
// trusted types...
z.config({ jitless: true });

const lora = Lora({
	weight: ['400', '700'],
	style: ['italic', 'normal'],
	subsets: ['latin', 'latin-ext'],
	display: 'swap'
});

const csp = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set<SourceExpression>([
		...DefaultContentSecurityPolicy['connect-src']!,
		'https://accounts.google.com',
		ZEMN_ME_API_BASE as 'https://api.zemn.me',
		'https://www.googleapis.com', // dub-dub-dub?? what year is it?
	])
}

export function RootLayout({ children }: Props) {
	return (
		<>
		<Providers>
			<html>
				<head>
					<link href="/icon.svg" rel="icon" type="image/svg+xml" />
					<link
						href="/icon.svg"
						rel="apple-touch-icon"
						type="image/svg+xml"
					/>
					<HeaderTagsAppRouter cspPolicy={csp} />
				</head>
				<body className={lora.className}>
					<Glade>
					{children}
					</Glade>
				</body>
			</html>
		</Providers>
		</>
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
	title: {
		default: 'zemn.me',
		template: '%s ← zemn.me',
	},
    alternates: {
        canonical: './',
    }
};
