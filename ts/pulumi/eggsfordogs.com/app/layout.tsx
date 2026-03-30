import { ReactNode } from 'react';

import { ClientProviders, HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

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
