'use client';

import { useEffect, useState } from 'react';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { mapViewport } from '#root/project/me/zemn/app/journal/location_geometry.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import { VectorMap } from '#root/project/me/zemn/app/journal/vector_map.js';
import { useVisibleCopyright } from '#root/project/me/zemn/components/CopyrightNotices/index.js';
import Link from '#root/project/me/zemn/components/Link/index.js';

type Entry = components['schemas']['JournalEntry'];
const mapHeight = 144;

const mapCopyright = {
	key: 'openstreetmap',
	content: (
		<>
			Maps ©{' '}
			<a
				href="https://www.openstreetmap.org/copyright"
				target="_blank"
				rel="noreferrer"
			>
				OpenStreetMap contributors
			</a>
		</>
	),
};

export function JournalMap({
	entries,
}: {
	readonly entries: readonly Entry[];
}) {
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(0);
	const visible = useVisibleCopyright(container, mapCopyright);
	const located = entries.filter(
		(
			entry
		): entry is Entry & { location: NonNullable<Entry['location']> } =>
			entry.location !== undefined
	);
	const hasLocations = located.length > 0;
	useEffect(() => {
		if (!container) return;
		const resize = new ResizeObserver(() =>
			setWidth(container.clientWidth)
		);
		resize.observe(container);
		return () => resize.disconnect();
	}, [container]);
	if (!hasLocations) return null;
	const view = mapViewport(
		located.map(entry => entry.location),
		width,
		mapHeight
	);

	return (
		<div
			className={style.locationMap}
			ref={setContainer}
			role="region"
			aria-label={`Recording locations: ${located.length} ${located.length === 1 ? 'voice note' : 'voice notes'}`}
		>
			{visible && width > 0 && (
				<VectorMap {...view} width={width} height={mapHeight} />
			)}
			{width > 0 &&
				located.map((entry, index) => {
					const point = view.points[index];
					if (!point) return null;
					const label = `${entry.title ?? entry.summary?.title ?? 'Voice note'} — ${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)} (accuracy ${Math.round(entry.location.accuracyMeters)} m)`;
					return (
						<Link
							key={entry.id}
							className={style.mapPin}
							style={{ left: point.x, top: point.y }}
							href={`/journal/day?at=${encodeURIComponent(entry.recordedAt)}&entry=${encodeURIComponent(entry.id)}#entry-${entry.id}`}
							aria-label={label}
							title={label}
						>
							<span aria-hidden="true" />
						</Link>
					);
				})}
		</div>
	);
}
