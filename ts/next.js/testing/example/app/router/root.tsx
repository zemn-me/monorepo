import { Outlet, Scripts } from 'react-router';

import Layout from '../layout.js';

export default function Root() {
	return (
		<Layout>
			<Outlet />
			<Scripts />
		</Layout>
	);
}

export function HydrateFallback() {
	return (
		<Layout>
			Hello, world!
			<Scripts />
		</Layout>
	);
}
