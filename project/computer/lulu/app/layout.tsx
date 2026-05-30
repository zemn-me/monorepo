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

export interface Props {
	readonly children?: ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<html>
			<body>
				<HeaderTagsAppRouter cspPolicy={csp} />
				<AnalyticsPageBeacon />
				{children}
			</body>
		</html>
	);
}
