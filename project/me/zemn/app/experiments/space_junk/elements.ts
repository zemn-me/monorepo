import type { LoaderFunctionArgs } from 'react-router';
import { jday } from 'satellite.js';

import { archivedOrbit } from './orbit.js';

export async function loader({ params, request }: LoaderFunctionArgs) {
	const id = Number(params.id);
	const date = new Date(Number(params.minute) * 60000);
	if (
		!/^\d{1,5}$/.test(params.id ?? '') ||
		!id ||
		!/^-?\d{1,9}$/.test(params.minute ?? '') ||
		date.getUTCFullYear() < 1957 ||
		date.getTime() > Date.now()
	) {
		return new Response('Invalid object or time', { status: 400 });
	}
	const signal = AbortSignal.any([
		request.signal,
		AbortSignal.timeout(10000),
	]);
	// SatChecker keeps historical TLEs and newer OMMs in separate collections.
	const formats =
		date.getUTCFullYear() >= 2026 ? ['omm', 'tle'] : ['tle', 'omm'];
	const headers = {
		'Cache-Control': 'public, max-age=86400, s-maxage=86400',
	};
	try {
		for (const format of formats) {
			const url = new URL(
				`https://satchecker.cps.iau.org/tools/get-nearest-${format}/`
			);
			url.search = new URLSearchParams({
				id: String(id),
				id_type: 'catalog',
				epoch: String(jday(date)),
			}).toString();
			const response = await fetch(url, { signal });
			if (!response.ok) throw new Error('Archive unavailable');
			const data = await response.json();
			const records = data?.[0]?.orbital_data;
			if (!Array.isArray(records))
				throw new Error('Unrecognized archive response');
			for (const record of records) {
				const orbit = archivedOrbit(record, id, date);
				if (orbit) return Response.json(orbit, { headers });
			}
		}
		return Response.json(null, { headers });
	} catch {
		return new Response('The orbit archive could not be reached.', {
			status: 502,
		});
	}
}
