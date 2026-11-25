import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { inOrbitAt, type SpaceObject } from './chart.js';
import { lookFrom, type Orbit } from './orbit.js';
import style from './style.module.css';
import { ObjectGlyph } from './wheel.js';

interface Observer {
	time: string;
	latitude: number;
	longitude: number;
}

function SkyReading({
	birthday,
	objects,
	observer,
}: {
	birthday: string;
	objects: SpaceObject[];
	observer: Observer;
}) {
	const instant = birthday + 'T' + observer.time;
	const minute = Date.parse(instant + 'Z') / 60000;
	const eligible = objects.filter(object => inOrbitAt(object, instant));
	const queries = useQueries({
		queries: eligible.map(object => ({
			queryKey: ['space-junk-orbit', object.id, minute],
			meta: { persist: false },
			retry: false,
			staleTime: Infinity,
			queryFn: async ({
				signal,
			}: {
				signal: AbortSignal;
			}): Promise<Orbit | null> => {
				const response = await fetch(
					`/experiments/space-junk/orbit/${object.id}/${minute}`,
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
			<h3>Sky at {observer.time} UTC</h3>
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
								'Free flight is unconfirmed at this minute.'
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
	birthday,
	objects,
}: {
	birthday: string;
	objects: SpaceObject[];
}) {
	const [observer, setObserver] = useState<Observer>();
	const [open, setOpen] = useState(false);
	return (
		<details
			className={style.sky}
			onToggle={e => setOpen(e.currentTarget.open)}
		>
			<summary>See the sky from your birthplace</summary>
			<p>
				To locate the objects on this results page, enter the UTC time
				on {birthday} and the coordinates of your birthplace. If
				converting to UTC changes the date, enter the UTC date above.
				Use negative numbers for south and west.
			</p>
			<form
				className={style.form}
				onSubmit={e => {
					e.preventDefault();
					const data = new FormData(e.currentTarget);
					setObserver({
						time: String(data.get('time')),
						latitude: Number(data.get('latitude')),
						longitude: Number(data.get('longitude')),
					});
				}}
			>
				<label>
					Birth time (UTC)
					<input type="time" name="time" required />
				</label>
				<label>
					Latitude (°)
					<input
						type="number"
						name="latitude"
						min="-90"
						max="90"
						step="any"
						required
					/>
				</label>
				<label>
					Longitude (°)
					<input
						type="number"
						name="longitude"
						min="-180"
						max="180"
						step="any"
						required
					/>
				</label>
				<button type="submit">Draw local sky</button>
			</form>
			{open && observer && (
				<SkyReading
					birthday={birthday}
					objects={objects}
					observer={observer}
				/>
			)}
			<small>
				Positions estimated with SGP4 using historical elements from{' '}
				<a href="https://satchecker.cps.iau.org/">IAU CPS SatChecker</a>
				, which archives{' '}
				<a href="https://www.space-track.org/">Space-Track</a> and{' '}
				<a href="https://celestrak.org/">CelesTrak</a> data.
			</small>
		</details>
	);
}
