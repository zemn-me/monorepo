import { Outlet } from 'react-router';

import {
	MetadataRouteContext,
	metadataToMetaDescriptors,
	viewportToMetaDescriptors,
} from '#root/ts/remix/index.js';

import Layout, { metadata, viewport } from '../layout.js';

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

export function meta(route: MetadataRouteContext) {
	return [
		...metadataToMetaDescriptors(metadata, { route }),
		...viewportToMetaDescriptors(viewport),
	];
}
