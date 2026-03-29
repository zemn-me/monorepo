import 'ts/pulumi/pleaseintroducemetoyour.dog/app/base.css';

import { Metadata } from 'next/types/index.js';
import { ReactNode } from 'react';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
} from '#root/ts/next.js/index.js';
import { ClientProviders } from '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/clientProviders.js';

const csp_policy: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set([
		'https://*.reddit.com',
		'https://*.redd.it',
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
	]),
	'img-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['img-src'] ?? []),
	]),
	'media-src': new Set([
		'https://*.redd.it',
		'https://*.reddit.com',
		...(DefaultContentSecurityPolicy['media-src'] ?? []),
	]),
};

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<html>
			<body>
				<ClientProviders>
					<HeaderTagsAppRouter cspPolicy={csp_policy} />
					{children}
				</ClientProviders>
			</body>
		</html>
	);
}

export default RootLayout;

export const metadata: Metadata = {
	formatDetection: {
		telephone: false,
		email: false,
		url: false,
	},
	title: {
		default: 'pleaseintroducemetoyour.dog',
		template: '%s 🐕 pleaseintroducemetoyour.dog',
	},
};
