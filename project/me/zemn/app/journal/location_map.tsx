'use client';

import {
	faChevronDown,
	faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { mapViewport } from '#root/project/me/zemn/app/journal/location_geometry.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';
import { VectorMap } from '#root/project/me/zemn/app/journal/vector_map.js';
import Link from '#root/project/me/zemn/components/Link/index.js';

type Entry = components['schemas']['JournalEntry'];
const mapHeight = 144;

export function JournalMap({
	entries,
}: {
	readonly entries: readonly Entry[];
}) {
	const container = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [visible, setVisible] = useState(false);
	const located = entries.filter(
		(
			entry
		): entry is Entry & { location: NonNullable<Entry['location']> } =>
			entry.location !== undefined
	);
	const hasLocations = located.length > 0;
	useEffect(() => {
		const element = container.current;
		if (!element) return;
		const resize = new ResizeObserver(() => setWidth(element.clientWidth));
		resize.observe(element);
		const observer = new IntersectionObserver(changes =>
			setVisible(changes.some(change => change.isIntersecting))
		);
		observer.observe(element);
		return () => {
			resize.disconnect();
			observer.disconnect();
		};
	}, [hasLocations]);
	if (!hasLocations) return null;
	const view = mapViewport(
		located.map(entry => entry.location),
		width,
		mapHeight
	);

	return (
		<details className={style.mapDisclosure}>
			<summary>
				<FontAwesomeIcon aria-hidden="true" icon={faMapLocationDot} />
				Recording locations
				<FontAwesomeIcon aria-hidden="true" icon={faChevronDown} />
			</summary>
			<div
				className={style.locationMap}
				ref={container}
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
			<span className={style.mapAttribution}>
				©{' '}
				<a
					href="https://www.openstreetmap.org/copyright"
					target="_blank"
					rel="noreferrer"
				>
					OpenStreetMap
				</a>{' '}
				contributors
			</span>
		</details>
	);
}
