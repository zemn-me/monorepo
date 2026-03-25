import { ReactNode } from 'react';

import {
	CspPolicy,
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
} from '#root/ts/next.js/index.js';

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
			<body>
				<HeaderTagsAppRouter cspPolicy={pageCsp} domain="luke.shadwell.im" />
				{children}
			</body>
		</html>
	);
}

export default RootLayout;
