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

function archiveQuery(day: string, enabled: boolean) {
	return queryOptions({
		queryKey: ['space-junk-elements', day],
		enabled,
		staleTime: 86400000,
		gcTime: 60000,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`/experiments/space-junk/elements/${day}`,
				{ signal }
			);
			if (!response.ok) throw new Error('Unable to load archived orbits');
			return response.text();
		},
	});
}

function useMarkers(
	text: string | undefined,
	matches: { object: SpaceObject }[],
	instant: number
) {
	const elements = useMemo(
		() =>
			matches.length > 0 &&
			text &&
			Array.from(
				readElements(text, new Set(matches.map(m => m.object.id)))
			),
		[text, matches]
	);
	return useMemo(() => {
		if (!elements) return [];
		const time = new Date(instant);
		return catalogueMarkers(
			matches,
			positionsAt(elements, time),
			time.toISOString().slice(0, -1)
		);
	}, [matches, elements, instant]);
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
	const primary = useMarkers(exact.data, matches, instant);
	const neighbors = useMemo(() => {
		const date = Temporal.PlainDate.from(day);
		return [-1, 1, -2, 2, -3, 3]
			.map(days => ({
				day: date.add({ days }).toString(),
				adjacent: Math.abs(days) === 1,
			}))
			.filter(d => d.day >= '1957-01-01' && d.day <= lastDay);
	}, [day, lastDay]);
	const needNearby = matches.length > 0 && !primary.length;
	// Reuse cached measurements across the propagation window. Only the
	// immediately adjacent archives are downloaded to fill a missing day.
	const nearby = useQueries({
		queries: neighbors.map(d =>
			archiveQuery(
				d.day,
				enabled && d.adjacent && needNearby && !exact.isPending
			)
		),
		combine: useCallback(
			(results: UseQueryResult<string>[]) => {
				const adjacent = results.filter(
					(_, i) => neighbors[i]!.adjacent
				);
				return {
					text: needNearby
						? results
								.map(q => q.data)
								.filter(Boolean)
								.join('\n')
						: '',
					pending: adjacent.some(q => q.isPending || q.isFetching),
					errors: adjacent.filter(q => q.isError).map(q => q.refetch),
				};
			},
			[neighbors, needNearby]
		),
	});
	const fallback = useMarkers(nearby.text, matches, instant);
	const markers = primary.length ? primary : fallback;
	const pending =
		needNearby && (exact.isPending || exact.isFetching || nearby.pending);

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
	return {
		markers: held?.markers ?? markers,
		instant: held?.instant ?? instant,
		pending,
		failed: needNearby && (exact.isError || nearby.errors.length > 0),
		retry: () => {
			if (exact.isError) void exact.refetch();
			for (const refetch of nearby.errors) void refetch();
		},
	};
}
