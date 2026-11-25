import type { LoaderFunctionArgs } from 'react-router';

import { type PositionRow, snapshotPositions } from './orbit.js';

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
		const response = await fetch(
			`https://spacebook.com/api/entity/tle/${day}`,
			{
				signal: AbortSignal.any([
					request.signal,
					AbortSignal.timeout(18000),
				]),
			}
		);
		let rows: PositionRow[] = [];
		if (response.status !== 404) {
			if (!response.ok) throw new Error('Archive unavailable');
			const tle = await response.text();
			if (tle.trim() && !/^1 .{5}.*\r?\n2 /m.test(tle))
				throw new Error('Unrecognized orbital elements');
			rows = snapshotPositions(tle, time);
		}
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
