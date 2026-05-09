import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTags,
} from '#root/ts/remix/index.js';

const pageCsp: CspPolicy = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set([
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
		'https://www.wikidata.org',
	]),
	'img-src': new Set([
		...(DefaultContentSecurityPolicy['img-src'] ?? []),
		'https://upload.wikimedia.org',
		'https://commons.wikimedia.org',
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
				<HeaderTags cspPolicy={pageCsp} />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

export default RootLayout;
