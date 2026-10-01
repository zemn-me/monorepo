import { Outlet } from 'react-router';

import Glade from '#root/project/me/zemn/components/Glade/glade.js';
import { ErrorBoundary as RouteError } from '#root/ts/remix/error.js';

export default function GladeLayout() {
	return (
		<Glade>
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
