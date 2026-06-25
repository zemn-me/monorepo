import { type ReactNode } from 'react';

export const metadata = {
	title: 'Resistor Colour Identifier / Calculator',
	description:
		"A resistor colour calculator that works in reverse, is free, works on mobile, is easy to use and doesn't look like crap.",
	icons: {
		icon: '/i.png',
		apple: '/i-lrg.png',
	},
};

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
