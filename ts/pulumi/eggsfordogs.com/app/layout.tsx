import { ReactNode } from 'react';
import { Links, Meta, Scripts } from 'react-router';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<head>
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
