import { ReactNode } from 'react';

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
