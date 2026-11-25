import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
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
		return [-1, 1]
			.map(days => date.add({ days }).toString())
			.filter(d => d >= '1957-01-01' && d <= lastDay);
	}, [day, lastDay]);
	// Observe both adjacent days in the cache during a handoff. Fetch them only
	// if the selected day's archive couldn't supply any usable positions.
	const needNearby = matches.length > 0 && !primary.length;
	const nearby = useQueries({
		queries: neighbors.map(d =>
			archiveQuery(d, enabled && needNearby && !exact.isPending)
		),
	});
	const [first, second] = nearby.map(q => (needNearby ? q.data : undefined));
	const text = useMemo(
		() => [first, second].filter(Boolean).join('\n'),
		[first, second]
	);
	const fallback = useMarkers(text, matches, instant);
	const queries = [exact, ...nearby];
	return {
		markers: primary.length ? primary : fallback,
		pending: needNearby && queries.some(q => q.isPending || q.isFetching),
		failed: needNearby && queries.some(q => q.isError),
		retry: () => {
			for (const query of queries)
				if (query.isError) void query.refetch();
		},
	};
}
