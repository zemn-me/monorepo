import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

import { HeaderTags } from '#root/ts/remix/index.js';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<head>
				<Meta />
				<Links />
				<HeaderTags />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
