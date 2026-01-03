import { ReactNode } from 'react';

import { HeaderTagsAppRouter } from '#root/ts/next.js/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<body>
				<HeaderTagsAppRouter domain="lulu.computer"/>
				{children}
			</body>
		</html>
	);
}
