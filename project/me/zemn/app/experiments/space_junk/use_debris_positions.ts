import {
	queryOptions,
	useQueries,
	useQuery,
	type UseQueryResult,
} from '@tanstack/react-query';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Temporal } from 'temporal-polyfill';

import type { SpaceObject } from './chart.js';
import { catalogueMarkers } from './globe_geometry.js';
import { positionsAt, readElements } from './orbit.js';
import { orbitElementsUrl } from './orbit_archive.js';

function indexElements(text: string) {
	return Map.groupBy(readElements(text), record => record.id);
}

function archiveQuery(day: string, enabled = true) {
	return queryOptions({
		queryKey: ['space-junk-elements', day],
		select: indexElements,
		enabled,
		// The browser's HTTP cache retains historical archives after this in-memory entry is evicted.
		staleTime: 15 * 60000,
		gcTime: 60000,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }) => {
			const response = await fetch(orbitElementsUrl(day), { signal });
			if (!response.ok) throw new Error('Unable to load archived orbits');
			return response.text();
		},
	});
}

export function useDebrisPositions(
	matches: { object: SpaceObject }[],
	instant: number,
	day: string,
	lastDay: string
) {
	const [archiveDay, setArchiveDay] = useState(day);
	const lastRequest = useRef(0);
	useEffect(() => {
		if (archiveDay === day) return;
		// Sample while scrubbing and always request the date where the ruler stops.
		const timer = window.setTimeout(
			() => {
				lastRequest.current = performance.now();
				setArchiveDay(day);
			},
			Math.max(0, 200 - (performance.now() - lastRequest.current))
		);
		return () => window.clearTimeout(timer);
	}, [archiveDay, day]);

	const enabled = day === archiveDay && matches.length > 0;
	const exact = useQuery(archiveQuery(day, enabled));
	const neighbors = useMemo(() => {
		const date = Temporal.PlainDate.from(day);
		return [-1, 1, -2, 2, -3, 3]
			.map(days => ({
				day: date.add({ days }).toString(),
				adjacent: Math.abs(days) === 1,
			}))
			.filter(d => d.day >= '1957-01-01' && d.day <= lastDay);
	}, [day, lastDay]);
	// Warm only the immediate neighbors and only when the selected day has
	// settled. More distant archives are useful if they are already cached.
	const [settledDay, setSettledDay] = useState('');
	useEffect(() => {
		if (!enabled || exact.isPending) return;
		const timer = window.setTimeout(() => setSettledDay(day), 400);
		return () => window.clearTimeout(timer);
	}, [day, enabled, exact.isPending]);

	const nearby = useQueries({
		queries: neighbors.map(d =>
			archiveQuery(d.day, enabled && d.adjacent && settledDay === day)
		),
		combine: useCallback(
			(results: UseQueryResult<ReturnType<typeof indexElements>>[]) => {
				const adjacent = results.filter(
					(_, i) => neighbors[i]!.adjacent
				);
				return {
					indexes: results.flatMap(q =>
						q.data?.size ? [q.data] : []
					),
					pending: adjacent.some(q => q.isPending || q.isFetching),
					errors: adjacent.filter(q => q.isError).map(q => q.refetch),
				};
			},
			[neighbors]
		),
	});
	const markers = useMemo(() => {
		if (!exact.data?.size && !nearby.indexes.length) return [];
		const time = new Date(instant);
		return catalogueMarkers(
			matches,
			id => {
				const primary = exact.data?.get(id);
				if (primary) {
					const [row] = positionsAt(primary, time);
					if (row) return row;
				}
				const alternatives = nearby.indexes.flatMap(
					index => index.get(id) ?? []
				);
				return alternatives.length
					? positionsAt(alternatives, time)[0]
					: undefined;
			},
			time.toISOString().slice(0, -1)
		);
	}, [exact.data, nearby.indexes, matches, instant]);
	const missing = matches.length > 0 && !markers.length;
	const pending =
		missing && (exact.isPending || exact.isFetching || nearby.pending);

	// During a long jump, keep the last committed layer at its own timestamp
	// until the archive supplies positions or confirms that there are none.
	const previous = useRef<{ markers: typeof markers; instant: number }>(
		undefined
	);
	useLayoutEffect(() => {
		if (markers.length) previous.current = { markers, instant };
		else if (!pending) previous.current = undefined;
	}, [markers, instant, pending]);
	const held = !markers.length && pending ? previous.current : undefined;
	// A held frame belongs to an earlier date or search. Keep only objects
	// still requested, in the catalogue order for the new date.
	const displayed = useMemo(() => {
		if (!held) return markers;
		const byId = new Map(
			held.markers.map(marker => [marker.object.id, marker])
		);
		return matches.flatMap(({ object }) => {
			const marker = byId.get(object.id);
			return marker ? [marker] : [];
		});
	}, [held, markers, matches]);
	return {
		markers: displayed,
		instant: held?.instant ?? instant,
		pending,
		failed: missing && (exact.isError || nearby.errors.length > 0),
		retry: () => {
			if (exact.isError) void exact.refetch();
			for (const refetch of nearby.errors) void refetch();
		},
	};
}
