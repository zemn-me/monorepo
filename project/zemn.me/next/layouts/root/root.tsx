import { TopLevelNavigationBar } from 'project/zemn.me/next/layouts/root/TopLevelNavigationBar/TopLevelNavigationBar';

export interface Props {
	readonly children?: React.ReactNode;
	readonly noLogo?: boolean;
}

export function RootLayout({ children, noLogo }: Props) {
	return (
		<>
			<TopLevelNavigationBar {...{ noLogo }} />
			{children}
		</>
	);
}
