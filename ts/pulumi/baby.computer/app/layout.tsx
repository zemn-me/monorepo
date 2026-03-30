import { ReactNode } from 'react';
import React from 'react';

import { ClientProviders } from '#root/ts/next.js/component/ClientProviders/ClientProviders.js';
import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<body>
				<ClientProviders>
					<HeaderTagsAppRouter />
					{children}
				</ClientProviders>
			</body>
		</html>
	);
}
