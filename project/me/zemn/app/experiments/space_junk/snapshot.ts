import type { LoaderFunctionArgs } from 'react-router';

import { orbitElementsUrl } from './orbit_archive.js';
import { snapshotPositions } from './orbit.js';

export async function loader({ params, request }: LoaderFunctionArgs) {
	const time = new Date(Number(params.minute) * 60000);
	if (
		!/^-?\d{1,9}$/.test(params.minute ?? '') ||
		time.getUTCFullYear() < 1957 ||
		time.getTime() > Date.now()
	)
		return new Response('Invalid chart time', { status: 400 });

	const day = time.toISOString().slice(0, 10);
	try {
		const response = await fetch(orbitElementsUrl(day), {
			signal: request.signal,
		});
		if (!response.ok) throw new Error('Archive unavailable');
		const rows = snapshotPositions(await response.text(), time);
		return Response.json(rows, {
			headers: {
				'Cache-Control':
					response.headers.get('Cache-Control') ?? 'no-store',
			},
		});
	} catch {
		return new Response('The Spacebook archive could not be reached.', {
			status: 502,
		});
	}
}
