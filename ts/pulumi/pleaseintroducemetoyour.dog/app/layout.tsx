import './base.css';

import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';
import { ClientProviders } from '#root/ts/pulumi/pleaseintroducemetoyour.dog/app/clientProviders.js';
import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTags,
	Metadata,
} from '#root/ts/remix/index.js';

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
			<head>
				<Meta />
				<Links />
				<HeaderTags cspPolicy={csp_policy} />
			</head>
			<body>
				<ClientProviders>
					{children}
					<Scripts />
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
