import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayForm } from './birthday_form.js';
import { ChartSettings } from './birthplace.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { Globe } from './globe.js';
import { catalogueMarkers, groundLocation } from './globe_geometry.js';
import type { PositionRow } from './orbit.js';
import { Sky } from './sky.js';
import style from './style.module.css';
import { type Birthplace, zodiacFrame } from './zodiac.js';
import { ZodiacWheel } from './zodiac_wheel.js';

function displayDate(day: string) {
	return Temporal.PlainDate.from(day.slice(0, 10)).toLocaleString('en-GB', {
		dateStyle: 'long',
	});
}

function BirthdayChart({
	catalogue,
	birthday,
}: {
	catalogue: Catalogue;
	birthday: Temporal.PlainDate;
}) {
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const { matches } = useMemo(
		() => readChart(catalogue.objects, birthday),
		[catalogue, birthday]
	);
	const day = birthday.toString();
	const [time, setTime] = useState('12:00');
	const [view, setView] = useState<'wheel' | 'earth'>('wheel');
	const [place, setPlace] = useState<Birthplace>();
	const [selection, setSelection] = useState<{
		id: number;
		revision: number;
	}>();
	function locate(id: number) {
		setSelection(previous => ({
			id,
			revision: (previous?.revision ?? 0) + 1,
		}));
	}
	const instant = day + 'T' + time;
	const minute = Date.parse(instant + ':00Z') / 60000;
	const snapshot = useQuery({
		queryKey: ['space-junk-positions', minute],
		networkMode: 'always',
		enabled: matches.length > 0 && day <= catalogue.asOf,
		staleTime: 86400000,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }): Promise<PositionRow[]> => {
			const response = await fetch(
				`/experiments/space-junk/positions/${minute}`,
				{ signal }
			);
			if (!response.ok) throw new Error('Unable to load archived orbits');
			return response.json();
		},
	});
	const markers = useMemo(
		() => catalogueMarkers(matches, snapshot.data ?? [], instant),
		[matches, snapshot.data, instant]
	);
	const byId = useMemo(
		() => new Map(markers.map(m => [m.object.id, m])),
		[markers]
	);
	const selected = selection && byId.get(selection.id);
	const zodiac = useMemo(
		() => zodiacFrame(new Date(minute * 60000), place),
		[minute, place]
	);
	const placements = useMemo(
		() =>
			markers.map(marker => ({
				marker,
				...zodiac.direction(marker.fixed),
			})),
		[markers, zodiac]
	);
	const focus =
		placements.find(p => p.marker.object.id === selected?.object.id) ??
		placements[0];
	const location = selected && groundLocation(selected);
	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return matches;
		return matches.filter(({ object }) =>
			`${object.name} ${object.piece} ${object.id} ${kinds[object.kind]}`
				.toLowerCase()
				.includes(term)
		);
	}, [matches, search]);
	const pageSize = 12;
	const offset = page * pageSize;
	const rows = filtered.slice(offset, offset + pageSize);

	const count = matches.length;
	if (birthday.toString() > catalogue.asOf)
		return (
			<p role="status">
				Choose a date on or before {displayDate(catalogue.asOf)}, the
				date of this catalog edition.
			</p>
		);
	if (!count)
		return (
			<p role="status">
				No catalogued debris in orbit on {displayDate(day)}.
			</p>
		);
	return (
		<>
			<div
				className={style.chartModes}
				role="group"
				aria-label="Chart view"
			>
				<button
					type="button"
					aria-pressed={view === 'wheel'}
					onClick={() => setView('wheel')}
				>
					Zodiac wheel
				</button>
				<button
					type="button"
					aria-pressed={view === 'earth'}
					onClick={() => setView('earth')}
				>
					Earth orbits
				</button>
			</div>
			<figure className={style.figure}>
				{view === 'wheel' ? (
					<ZodiacWheel
						placements={placements}
						ascendant={zodiac.ascendant}
						selected={focus}
						onSelect={m => locate(m.object.id)}
					/>
				) : (
					<Globe
						key={selected ? selection?.revision : 'earth'}
						markers={markers}
						selected={selected}
						onSelect={m => locate(m.object.id)}
					/>
				)}

				<figcaption aria-live="polite" className={style.caption}>
					<time dateTime={day}>{displayDate(day)}</time>
					{' · '}
					{time} UTC
					{snapshot.isError ? (
						<p role="alert">
							Orbit archive unavailable.{' '}
							<button
								type="button"
								onClick={() => void snapshot.refetch()}
							>
								Retry
							</button>
						</p>
					) : (
						<p role="status" aria-label="Chart coverage">
							{snapshot.data
								? `${markers.length.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} objects located`
								: 'Loading orbital positions…'}
						</p>
					)}
					{view === 'earth' && location && selected && (
						<p>
							{selected.object.name} ·{' '}
							{Math.abs(location.latitude).toFixed(2)}°
							{location.latitude < 0 ? 'S' : 'N'},{' '}
							{Math.abs(location.longitude).toFixed(2)}°
							{location.longitude < 0 ? 'W' : 'E'} ·{' '}
							{Math.round(location.height).toLocaleString(
								'en-GB'
							)}{' '}
							km above Earth
						</p>
					)}
				</figcaption>
			</figure>
			<ChartSettings
				time={time}
				place={place}
				ascendant={zodiac.ascendant}
				onTime={setTime}
				onPlace={setPlace}
			/>
			<details className={style.disclosure}>
				<summary>Object catalogue</summary>
				<input
					className={style.search}
					type="search"
					aria-label="Search by name, catalog number, designator or object type"
					placeholder="Search objects"
					value={search}
					onChange={event => {
						setSearch(event.target.value);
						setPage(0);
					}}
				/>
				<div className={style.paging}>
					<span role="status" aria-label="Catalogue results">
						{rows.length
							? `${(offset + 1).toLocaleString('en-GB')}–${(offset + rows.length).toLocaleString('en-GB')} of ${filtered.length.toLocaleString('en-GB')}`
							: 'No matching objects'}
					</span>
					{filtered.length > pageSize && (
						<>
							<button
								type="button"
								disabled={!page}
								onClick={() => setPage(page - 1)}
							>
								Previous
							</button>
							<button
								type="button"
								disabled={
									offset + rows.length >= filtered.length
								}
								onClick={() => setPage(page + 1)}
							>
								Next
							</button>
						</>
					)}
				</div>
				{rows.length > 0 && (
					<Sky
						observer={place && { ...place, time }}
						birthday={birthday.toString()}
						objects={rows.map(row => row.object)}
					/>
				)}

				<ul className={style.catalogue}>
					{rows.map(({ object, days }) => (
						<li key={object.id}>
							<h3>
								{byId.has(object.id) ? (
									<a
										href={
											view === 'earth'
												? '#orbital-globe'
												: '#zodiac-wheel'
										}
										onClick={() => locate(object.id)}
									>
										{object.name}
									</a>
								) : (
									object.name
								)}
							</h3>
							<p>
								{kinds[object.kind]} · {object.piece} · NORAD{' '}
								{object.id}
							</p>
							<p>
								{displayDate(object.start)} –{' '}
								{displayDate(object.end ?? catalogue.asOf)} ·{' '}
								{days === 0
									? 'Shares your birthday'
									: `Release anniversary ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} your birthday`}
							</p>
						</li>
					))}
				</ul>
			</details>
		</>
	);
}

export default function Page() {
	const [birthday, setBirthday] = useState<Temporal.PlainDate>();

	const catalogue = useQuery({
		queryKey: ['space-junk-catalogue', catalogueUrl],
		enabled: Boolean(birthday),
		staleTime: Infinity,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }): Promise<Catalogue> => {
			const response = await fetch(catalogueUrl, { signal });
			if (!response.ok) throw new Error('Unable to load GCAT');
			return response.json();
		},
	});
	return (
		<article className={style.page}>
			<h1>Space junk star chart</h1>
			<BirthdayForm
				asOf={catalogue.data?.asOf}
				showExample={!birthday}
				onDraw={setBirthday}
			/>
			{!birthday ? (
				<figure className={style.figure}>
					<ZodiacWheel />
				</figure>
			) : catalogue.data ? (
				<BirthdayChart
					key={birthday.toString()}
					birthday={birthday}
					catalogue={catalogue.data}
				/>
			) : catalogue.isError ? (
				<p role="alert">
					The catalog could not be loaded.{' '}
					<button
						type="button"
						onClick={() => void catalogue.refetch()}
					>
						Try again
					</button>
				</p>
			) : (
				<p role="status">Loading the orbital catalog…</p>
			)}
			<details className={style.disclosure}>
				<summary>Sources</summary>
				<p>
					Dated Earth-orbit records from{' '}
					<a href="https://planet4589.org/space/gcat/">
						Jonathan McDowell’s General Catalog of Artificial Space
						Objects
					</a>{' '}
					(
					<a href="https://creativecommons.org/licenses/by/4.0/">
						CC BY 4.0
					</a>
					).
					{catalogue.data &&
						` Edition of ${displayDate(catalogue.data.asOf)}.`}{' '}
					Only objects with confirmed flight times and an orbit within
					three days appear on the chart. Positions use SGP4 and
					historical elements from{' '}
					<a href="https://spacebook.com/">COMSPOC Spacebook</a>.
					Coastlines from{' '}
					<a href="https://www.naturalearthdata.com/">
						Natural Earth
					</a>
					.
				</p>
			</details>
		</article>
	);
}
export const metadata: Metadata = {
	title: 'Space junk star chart',
	description:
		'Find the space junk that shared your birthday in Earth orbit.',
};
export const handle = { metadata };
