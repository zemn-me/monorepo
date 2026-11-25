import type { LoaderFunctionArgs } from 'react-router';

export interface City {
	id: number;
	name: string;
	admin1?: string;
	country?: string;
	latitude: number;
	longitude: number;
	timezone: string;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const name = params.name?.trim();
	if (!name || name.length < 2 || name.length > 120) return Response.json([]);
	const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
	url.searchParams.set('name', name);
	url.searchParams.set('count', '8');
	url.searchParams.set(
		'language',
		new URL(request.url).searchParams.get('lang') || 'en'
	);
	try {
		const response = await fetch(url, {
			signal: AbortSignal.any([
				request.signal,
				AbortSignal.timeout(8000),
			]),
		});
		if (!response.ok) throw new Error('City search unavailable');
		const { results = [] }: { results?: City[] } = await response.json();
		return Response.json(
			results.filter(
				city =>
					city.timezone &&
					Number.isFinite(city.latitude) &&
					Number.isFinite(city.longitude)
			),
			{
				headers: { 'Cache-Control': 'public, max-age=86400' },
			}
		);
	} catch {
		return new Response('City search unavailable', { status: 502 });
	}
}
