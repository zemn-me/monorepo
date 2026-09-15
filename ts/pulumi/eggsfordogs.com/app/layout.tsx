import { ReactNode } from 'react';

import { AnalyticsPageBeacon } from '#root/project/me/zemn/api/analytics/AnalyticsPageBeacon.js';
import {
	DefaultContentSecurityPolicy,
	HeaderTagsAppRouter,
	SourceExpression,
} from '#root/ts/next.js/index.js';

const csp = {
	...DefaultContentSecurityPolicy,
	'connect-src': new Set<SourceExpression>([
		...(DefaultContentSecurityPolicy['connect-src'] ?? []),
		'https://api.zemn.me',
		'http://localhost:*' as 'https://localhost',
	]),
};

export const metadata = {
	title: 'Eggs for dogs — a little park, endless joy',
	description:
		'A tiny interactive 3D dog park. Toss an egg, meet six very good dogs, and take a moment to play.',
};

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html lang="en">
			<body>
				<HeaderTagsAppRouter cspPolicy={csp} />
				<AnalyticsPageBeacon />
				{children}
			</body>
		</html>
	);
}
