import { queryOptions } from '@tanstack/react-query';
import * as assets from './assets.js';

export interface City {
	id: number;
	name: string;
	admin1: string;
	country: string;
	latitude: number;
	longitude: number;
	timezone: string;
}

type CityRow = [
	id: number,
	name: string,
	region: string,
	country: string,
	latitude: number,
	longitude: number,
	zone: string,
	names: string[],
];
const shardUrls = Object.entries(assets)
	.filter(([key]) => key.startsWith('cityShard'))
	.sort(
		([a], [b]) =>
			Number(a.slice('cityShard'.length)) -
			Number(b.slice('cityShard'.length))
	)
	.map(([, url]) => url);
export const cityShardCount = shardUrls.length;
export function foldCityName(name: string) {
	return name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim();
}
export function nameShard(name: string) {
	const [a, b] = Array.from(name);
	if (!a || !b) return null;
	return (a.codePointAt(0)! * 31 + b.codePointAt(0)!) % cityShardCount;
}
export function cityShard(key: number | null) {
	const url = key === null ? undefined : shardUrls[key];
	return queryOptions({
		queryKey: ['birth-city-shard', url],
		enabled: key !== null,
		staleTime: Infinity,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }): Promise<CityRow[]> => {
			if (!url) throw new Error('Unknown city index shard');
			const response = await fetch(url, { signal });
			if (!response.ok || !response.body)
				throw new Error('City index unavailable');
			return new Response(
				response.body.pipeThrough(new DecompressionStream('gzip'))
			).json();
		},
	});
}
export function readCity([
	id,
	name,
	admin1,
	country,
	latitude,
	longitude,
	timezone,
]: CityRow): City {
	return { id, name, admin1, country, latitude, longitude, timezone };
}
export function findCities(rows: CityRow[], term: string) {
	// Rows are population-ranked. Prefer exact names, then alternate names,
	// before considering prefixes in the same order.
	const groups: City[][] = [[], [], [], []];
	for (const row of rows) {
		if (!row[7].some(name => name.startsWith(term))) continue;
		const primary = foldCityName(row[1]);
		const rank =
			primary === term
				? 0
				: row[7].includes(term)
					? 1
					: primary.startsWith(term)
						? 2
						: 3;
		if (groups[rank]!.length < 8) groups[rank]!.push(readCity(row));
	}
	return groups.flat().slice(0, 8);
}
