import type { LoaderFunctionArgs } from 'react-router';

import { fetchDayElements } from './daily_elements.js';
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
		const rows = snapshotPositions(
			await fetchDayElements(day, request.signal),
			time
		);
		return Response.json(rows, {
			headers: {
				'Cache-Control': 'public, max-age=86400, s-maxage=86400',
			},
		});
	} catch {
		return new Response('The Spacebook archive could not be reached.', {
			status: 502,
		});
	}
}
