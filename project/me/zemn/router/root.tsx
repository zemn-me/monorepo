import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { Outlet } from 'react-router';

import Layout from '#root/project/me/zemn/app/layout.js';

import { rootMeta } from './meta.js';

export default function Root() {
	return (
		<NuqsAdapter>
			<Layout>
				<Outlet />
			</Layout>
		</NuqsAdapter>
	);
}

export function HydrateFallback() {
	return <Layout />;
}

export const meta = rootMeta;
