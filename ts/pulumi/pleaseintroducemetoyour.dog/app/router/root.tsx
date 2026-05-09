import { Outlet } from 'react-router';

import Layout from '../layout.js';

import { rootMeta } from './meta.js';

export default function Root() {
	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}

export function HydrateFallback() {
	return <Layout />;
}

export const meta = rootMeta;
