import type { LoaderFunctionArgs } from 'react-router';
import { orbitElementsUrl } from './orbit_archive.js';

// Older chart bundles and bookmarks still use the frontend URL.
export function loader({ params }: LoaderFunctionArgs) {
	return Response.redirect(orbitElementsUrl(params.day ?? ''), 308);
}
