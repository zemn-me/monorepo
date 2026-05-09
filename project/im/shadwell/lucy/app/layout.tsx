import { ReactNode } from 'react';

import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<HeaderTagsAppRouter />
			</head>
			<body>{children}</body>
		</html>
	);
}

export default RootLayout;
