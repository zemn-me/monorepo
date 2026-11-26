import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { inOrbitAt, type SpaceObject } from './chart.js';
import { ObjectGlyph } from './object_glyph.js';
import { lookFrom, type Orbit } from './orbit.js';
import style from './style.module.css';

interface Observer {
	instant: number;
	zone: string;
	latitude: number;
	longitude: number;
}

function SkyReading({
	objects,
	observer,
}: {
	objects: SpaceObject[];
	observer: Observer;
}) {
	const instant = new Date(observer.instant).toISOString().slice(0, -1);
	const minute = Math.floor(observer.instant / 60_000);
	const offset = observer.instant - minute * 60_000;
	const eligible = objects.filter(object => inOrbitAt(object, instant));
	const queries = useQueries({
		queries: eligible.map(object => ({
			queryKey: ['space-junk-orbit-at', object.id, observer.instant],
			meta: { persist: false },
			retry: false,
			staleTime: Infinity,
			queryFn: async ({
				signal,
			}: {
				signal: AbortSignal;
			}): Promise<Orbit | null> => {
				const response = await fetch(
					`/experiments/space-junk/orbit/${object.id}/${minute}?offsetMs=${offset}`,
					{ signal }
				);
				if (!response.ok) throw new Error('Archive unavailable');
				return response.json();
			},
		})),
	});
	const positions = eligible.flatMap((object, i) => {
		const orbit = queries[i]?.data;
		return orbit
			? [
					{
						object,
						orbit,
						...lookFrom(
							orbit,
							observer.latitude,
							observer.longitude
						),
					},
				]
			: [];
	});
	return (
		<div aria-live="polite">
			<h3>
				Sky at{' '}
				{new Intl.DateTimeFormat(undefined, {
					timeZone: observer.zone,
					timeStyle: 'long',
				}).format(observer.instant)}
			</h3>
			<svg
				viewBox="-128 -128 256 256"
				className={style.skyMap}
				role="img"
				aria-label="Local sky, with the horizon at the rim and the zenith in the centre"
			>
				<g stroke="currentColor" fill="none">
					<circle r="98" />
					<circle r="49" strokeDasharray="2 4" />
					<path d="M-98 0H98 M0 -98V98" opacity=".45" />
				</g>
				<g fill="currentColor" textAnchor="middle" fontSize="12">
					<text y="-106">N</text>
					<text x="112" y="4">
						E
					</text>
					<text y="116">S</text>
					<text x="-112" y="4">
						W
					</text>
				</g>
				{positions
					.filter(p => p.elevation >= 0)
					.map(p => {
						const r = 98 * (1 - p.elevation / 90),
							angle = (p.azimuth * Math.PI) / 180;
						return (
							<g
								key={p.object.id}
								transform={`translate(${r * Math.sin(angle) - 13} ${-r * Math.cos(angle) - 13})`}
							>
								<title>{p.object.name}</title>
								<ObjectGlyph object={p.object} />
							</g>
						);
					})}
			</svg>
			<p>
				The rim is the horizon. Objects overhead appear near the centre.
			</p>
			<ul>
				{objects.map(object => {
					const p = positions.find(p => p.object.id === object.id);
					const i = eligible.findIndex(o => o.id === object.id);
					const q = queries[i];
					return (
						<li key={object.id}>
							<strong>{object.name}</strong>
							{' · '}
							{p ? (
								<>
									{p.elevation < 0
										? 'Below the horizon'
										: 'Above the horizon'}{' '}
									· {p.rising ? 'rising' : 'setting'} ·{' '}
									{p.elevation.toFixed(1)}° altitude ·{' '}
									{p.azimuth.toFixed(1)}° azimuth.
									<small>
										{' '}
										Orbit from {p.orbit.source},{' '}
										{p.orbit.epoch.slice(0, 10)} UTC.
									</small>
								</>
							) : i < 0 ? (
								'Free flight is unconfirmed at this time.'
							) : q?.isError ? (
								<>
									Archive unavailable.{' '}
									<button
										type="button"
										onClick={() => void q.refetch()}
									>
										Retry
									</button>
								</>
							) : q?.isPending ? (
								'Looking up its orbit…'
							) : (
								'No orbital record within three days.'
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function Sky({
	observer,
	objects,
}: {
	observer?: Observer;
	objects: SpaceObject[];
}) {
	const [open, setOpen] = useState(false);
	return (
		<details
			className={style.sky}
			onToggle={e => setOpen(e.currentTarget.open)}
		>
			<summary>Local horizon</summary>
			{observer ? (
				<p>
					Objects on this results page, viewed from{' '}
					{observer.latitude}°, {observer.longitude}°.
				</p>
			) : (
				<p>
					Choose your <a href="#chart-birth-city">city of birth</a> to
					see the objects above your horizon.
				</p>
			)}
			{open && observer && (
				<SkyReading objects={objects} observer={observer} />
			)}
		</details>
	);
}
