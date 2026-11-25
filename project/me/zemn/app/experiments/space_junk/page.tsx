import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayForm } from './birthday_form.js';
import { BirthplaceForm } from './birthplace.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { Globe } from './globe.js';
import { catalogueMarkers, groundLocation } from './globe_geometry.js';
import { ObjectGlyph } from './object_glyph.js';
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
	const lead = matches[0]?.object;
	const count = matches.length;
	if (birthday.toString() > catalogue.asOf)
		return (
			<p role="status">
				Choose a date on or before {displayDate(catalogue.asOf)}, the
				date of this catalog edition.
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
			<figure className={style.plate}>
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

				<figcaption aria-live="polite">
					<time dateTime={birthday.toString()}>
						✦ {displayDate(birthday.toString())}
					</time>
					<h2>
						{count
							? `${count.toLocaleString('en-GB')} ${count === 1 ? 'object' : 'objects'} in orbit`
							: 'A quiet sky'}
					</h2>
					{view === 'wheel' && (
						<p>
							The wheel looks down on Earth’s orbital plane from
							the north. Tilt it to see each object’s direction on
							a sky sphere, all drawn at equal distance.
						</p>
					)}
					{lead?.id === 29257 && (
						<p>
							There was a spatula in orbit the day you were born.
						</p>
					)}
					{!count && (
						<p>
							No debris with confirmed flight dates was in orbit
							on your birthday in this catalog.
						</p>
					)}

					{lead && (
						<>
							<form
								className={style.instant}
								onSubmit={e => {
									e.preventDefault();
									setTime(
										String(
											new FormData(e.currentTarget).get(
												'globe-time'
											)
										)
									);
								}}
							>
								<label>
									Chart time (UTC)
									<input
										type="time"
										name="globe-time"
										defaultValue={time}
										required
									/>
								</label>
								<button type="submit">Set time</button>
							</form>
							<BirthplaceForm
								place={place}
								onPlace={setPlace}
								wheel={view === 'wheel'}
								ascendant={zodiac.ascendant}
							/>
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
										? `${markers.length.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} located at ${time} UTC.`
										: 'Loading archived orbital positions…'}
								</p>
							)}
							{snapshot.data && markers.length < count && (
								<small>
									Other objects lack a recent orbit or
									confirmed flight time.
								</small>
							)}
							{markers.length > 0 && (
								<div className={style.legend}>
									<span>
										<i />
										Fragment
									</span>
									<span>
										<i />
										Rocket stage
									</span>
									<span>
										<i />
										Equipment
									</span>
								</div>
							)}
							{view === 'earth' && location && selected && (
								<p className={style.location}>
									<strong>{selected.object.name}</strong>
									<br />
									{Math.abs(location.latitude).toFixed(
										2
									)}° {location.latitude < 0 ? 'S' : 'N'},{' '}
									{Math.abs(location.longitude).toFixed(2)}°{' '}
									{location.longitude < 0 ? 'W' : 'E'}
									<br />
									{Math.round(location.height).toLocaleString(
										'en-GB'
									)}{' '}
									km above Earth
								</p>
							)}
						</>
					)}
				</figcaption>
			</figure>
			{lead && (
				<>
					<h2 className={style.sectionTitle}>Objects in orbit</h2>
					<label className={style.search}>
						Search by name, catalog number, designator or object
						type
						<input
							type="search"
							value={search}
							onChange={event => {
								setSearch(event.target.value);
								setPage(0);
							}}
						/>
					</label>
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
								<span className={style.icon}>
									<ObjectGlyph object={object} />
								</span>
								<div>
									<h3>{object.name}</h3>
									<p>
										{kinds[object.kind]} · {object.piece} ·
										NORAD {object.id}
									</p>
									<p className={style.relation}>
										{days === 0
											? 'Shares your birthday'
											: `Release anniversary ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} your birthday`}
									</p>
									<small>
										In free flight from{' '}
										{displayDate(object.start)}
										{object.end
											? ` through ${displayDate(object.end)}`
											: ` through the ${displayDate(catalogue.asOf)} catalog edition`}
										.
									</small>
									{byId.has(object.id) && (
										<a
											className={style.locate}
											href={
												view === 'earth'
													? '#orbital-globe'
													: '#zodiac-wheel'
											}
											onClick={() => locate(object.id)}
										>
											{view === 'earth'
												? 'Locate on globe'
												: 'Locate on wheel'}
										</a>
									)}
								</div>
							</li>
						))}
					</ul>
				</>
			)}
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
			<h1>
				Space junk <i>star chart</i>
			</h1>
			<p className={style.intro}>
				See where spent rockets, loose equipment and satellite fragments
				fell in the zodiac on your birthday.
			</p>
			<BirthdayForm asOf={catalogue.data?.asOf} onDraw={setBirthday} />
			{!birthday ? (
				<figure className={style.plate}>
					<ZodiacWheel />
					<figcaption>
						<h2>Your birthday wheel</h2>
						<p>
							Enter your birthday to place debris around the
							zodiac. Add a birthplace to put the rising sign on
							the left.
						</p>
					</figcaption>
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
			<p className={style.credit}>
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
				Debris positions use SGP4 and orbital elements within three days
				of the chosen time from{' '}
				<a href="https://spacebook.com/">COMSPOC Spacebook</a>.
				Coastlines from{' '}
				<a href="https://www.naturalearthdata.com/">Natural Earth</a>.
			</p>
		</article>
	);
}
export const metadata: Metadata = {
	title: 'Space junk star chart',
	description:
		'Find the space junk that shared your birthday in Earth orbit.',
};
export const handle = { metadata };
