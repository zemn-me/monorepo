import { ReactNode } from 'react';

import { ClientProviders } from '#root/ts/next.js/component/ClientProviders/ClientProviders.js';
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
				<ClientProviders>
					<HeaderTagsAppRouter cspPolicy={pageCsp} />
					{children}
				</ClientProviders>
			</body>
		</html>
	);
}

export default RootLayout;
