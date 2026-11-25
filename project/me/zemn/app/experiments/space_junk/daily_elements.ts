import type { LoaderFunctionArgs } from 'react-router';

export async function fetchDayElements(day: string, signal: AbortSignal) {
	const response = await fetch(
		`https://spacebook.com/api/entity/tle/${day}`,
		{
			signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]),
		}
	);
	if (response.status === 404) return '';
	if (!response.ok) throw new Error('Archive unavailable');
	const text = await response.text();
	if (text.trim() && !/^1 .{5}.*\r?\n2 /m.test(text))
		throw new Error('Unrecognized orbital elements');
	return text;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const day = params.day ?? '';
	const date = new Date(day + 'T00:00Z');
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
		!Number.isFinite(date.getTime()) ||
		date.toISOString().slice(0, 10) !== day ||
		date.getUTCFullYear() < 1957 ||
		date.getTime() > Date.now()
	) {
		return new Response('Invalid archive date', { status: 400 });
	}
	try {
		return new Response(await fetchDayElements(day, request.signal), {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'public, max-age=86400, s-maxage=86400',
			},
		});
	} catch {
		return new Response('The Spacebook archive could not be reached.', {
			status: 502,
		});
	}
}
