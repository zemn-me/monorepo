import { Outlet, useNavigation } from 'react-router';
import { useNavigationFailure } from '#root/project/me/zemn/app/navigation_failure.js';

import Glade from '#root/project/me/zemn/components/Glade/glade.js';
import { ErrorBoundary as RouteError } from '#root/ts/remix/error.js';

export default function GladeLayout() {
	const navigation = useNavigation();
	const failure = useNavigationFailure();
	return (
		<Glade
			navigationPending={navigation.state !== 'idle'}
			navigationFailed={failure.failed}
			retryNavigation={failure.retry}
		>
			<Outlet />
		</Glade>
	);
}

export function ErrorBoundary() {
	return (
		<Glade>
			<RouteError />
		</Glade>
	);
}
