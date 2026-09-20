'use client';

import { useEffect, useRef, useState } from 'react';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { mapViewport } from '#root/project/me/zemn/app/journal/location_geometry.js';
import style from '#root/project/me/zemn/app/journal/style.module.css';

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
	const count = 2 ** view.zoom;
	const tiles = [];
	if (visible && width > 0) {
		for (
			let x = Math.floor(view.left / 256);
			x <= Math.floor((view.left + width) / 256);
			x++
		) {
			for (
				let y = Math.max(0, Math.floor(view.top / 256));
				y <=
				Math.min(count - 1, Math.floor((view.top + mapHeight) / 256));
				y++
			) {
				tiles.push(
					<img
						key={`${x}/${y}`}
						alt=""
						aria-hidden="true"
						width={256}
						height={256}
						referrerPolicy="strict-origin-when-cross-origin"
						src={`https://tile.openstreetmap.org/${view.zoom}/${((x % count) + count) % count}/${y}.png`}
						style={{
							left: x * 256 - view.left,
							top: y * 256 - view.top,
						}}
					/>
				);
			}
		}
	}
	return (
		<div
			className={style.locationMap}
			ref={container}
			role="region"
			aria-label={`Recording locations: ${located.length} ${located.length === 1 ? 'voice note' : 'voice notes'}`}
		>
			{tiles}
			{width > 0 &&
				located.map((entry, index) => {
					const point = view.points[index];
					if (!point) return null;
					const label = `${entry.summary?.title ?? 'Voice note'} — ${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)} (accuracy ${Math.round(entry.location.accuracyMeters)} m)`;
					return (
						<a
							key={entry.id}
							className={style.mapPin}
							style={{ left: point.x, top: point.y }}
							href={`/journal/day?at=${encodeURIComponent(entry.recordedAt)}&entry=${encodeURIComponent(entry.id)}`}
							aria-label={label}
							title={label}
						>
							●
						</a>
					);
				})}
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
		</div>
	);
}
