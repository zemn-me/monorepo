import {
	faDharmachakra,
	faEarthAmericas,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
	memo,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Temporal } from 'temporal-polyfill';

import { useLocale } from '#root/ts/react/lang/useLocale.js';
import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayRulers } from './birthday_form.js';
import { ChartSettings } from './birthplace.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { Globe } from './globe.js';
import { catalogueMarkers, groundLocation } from './globe_geometry.js';
import { positionsAt, readElements } from './orbit.js';
import { Sky } from './sky.js';
import style from './style.module.css';
import { type Birthplace, zodiacFrame } from './zodiac.js';
import { ZodiacWheel } from './zodiac_wheel.js';

function displayDate(day: string) {
	return Temporal.PlainDate.from(day.slice(0, 10)).toLocaleString('en-GB', {
		dateStyle: 'long',
	});
}

const BirthdayChart = memo(function BirthdayChart({
	catalogue,
	instant,
}: {
	catalogue: Catalogue;
	instant: Temporal.PlainDateTime;
}) {
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const languages = useLocale();
	const targetDay = instant.toPlainDate().toString();
	const time = instant.toPlainTime().toString({ smallestUnit: 'minute' });
	const [archiveDay, setArchiveDay] = useState(targetDay);
	const lastRequest = useRef(0);
	useEffect(() => {
		if (archiveDay === targetDay) return;
		// Scrubbing can cross many dates per frame. Sample the latest date even
		// while the pointer is held, and always pick up the final one.
		const timer = window.setTimeout(
			() => {
				lastRequest.current = performance.now();
				setArchiveDay(targetDay);
			},
			Math.max(0, 200 - (performance.now() - lastRequest.current))
		);
		return () => window.clearTimeout(timer);
	}, [archiveDay, targetDay]);
	const snapshot = useQuery({
		queryKey: ['space-junk-elements', archiveDay],
		enabled: archiveDay >= '1957-01-01',
		staleTime: 86400000,
		gcTime: 60000,
		placeholderData: keepPreviousData,
		meta: { persist: false },
		retry: false,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`/experiments/space-junk/elements/${archiveDay}`,
				{ signal }
			);
			if (!response.ok) throw new Error('Unable to load archived orbits');
			return { day: archiveDay, text: await response.text() };
		},
	});
	// Keep the previous drawing and its actual date together while the next
	// archive loads. A missing or failed archive must never inherit its points.
	const archive = targetDay >= '1957-01-01' ? snapshot.data : undefined;
	const day = archive?.day ?? targetDay;
	const dayTime = day + 'T' + time;
	const epoch = Date.parse(dayTime + 'Z');
	const { matches } = useMemo(
		() => readChart(catalogue.objects, Temporal.PlainDate.from(day)),
		[catalogue, day]
	);
	const elements = useMemo(
		() =>
			archive
				? Array.from(
						readElements(
							archive.text,
							new Set(matches.map(m => m.object.id))
						)
					)
				: [],
		[archive, matches]
	);
	const markers = useMemo(
		() =>
			catalogueMarkers(
				matches,
				positionsAt(elements, new Date(epoch)),
				dayTime
			),
		[matches, elements, epoch, dayTime]
	);
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
	const byId = useMemo(
		() => new Map(markers.map(m => [m.object.id, m])),
		[markers]
	);
	const selected = selection && byId.get(selection.id);
	const zodiac = useMemo(
		() => zodiacFrame(new Date(epoch), place),
		[epoch, place]
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
	const pageIndex = Math.min(
		page,
		Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
	);
	const offset = pageIndex * pageSize;
	const rows = filtered.slice(offset, offset + pageSize);

	const count = matches.length;
	return (
		<>
			<div
				className={style.chartModes}
				role="group"
				aria-label="Chart view"
			>
				<button
					type="button"
					aria-label="Zodiac wheel"
					title="Zodiac wheel"
					aria-pressed={view === 'wheel'}
					onClick={() => setView('wheel')}
				>
					<FontAwesomeIcon icon={faDharmachakra} aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Earth orbits"
					title="Earth orbits"
					aria-pressed={view === 'earth'}
					onClick={() => setView('earth')}
				>
					<FontAwesomeIcon
						icon={faEarthAmericas}
						aria-hidden="true"
					/>
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
						key={selection?.revision}
						markers={markers}
						selected={selected}
						onSelect={m => locate(m.object.id)}
					/>
				)}

				<figcaption aria-live="polite" className={style.caption}>
					<time dateTime={dayTime + 'Z'}>
						{Temporal.PlainDate.from(day).toLocaleString(
							languages,
							{ dateStyle: 'long' }
						)}
					</time>
					{' · '}
					{time} UTC
					{!count && targetDay === day ? (
						<p>No catalogued debris in orbit on this date.</p>
					) : snapshot.isError && archiveDay === targetDay ? (
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
							{archive?.day === targetDay
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
				place={place}
				ascendant={zodiac.ascendant}
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
								disabled={!pageIndex}
								onClick={() => setPage(pageIndex - 1)}
							>
								Previous
							</button>
							<button
								type="button"
								disabled={
									offset + rows.length >= filtered.length
								}
								onClick={() => setPage(pageIndex + 1)}
							>
								Next
							</button>
						</>
					)}
				</div>
				{rows.length > 0 && (
					<Sky
						observer={place && { ...place, time }}
						birthday={day}
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
});

export default function Page() {
	const [instant, setInstant] = useState(() =>
		Temporal.PlainDateTime.from('2006-08-01T12:00')
	);
	const chartInstant = useDeferredValue(instant);

	const catalogue = useQuery({
		queryKey: ['space-junk-catalogue', catalogueUrl],
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
			{catalogue.data ? (
				<>
					<BirthdayRulers
						value={instant}
						asOf={Temporal.PlainDate.from(catalogue.data.asOf)}
						onChange={setInstant}
					/>
					<BirthdayChart
						instant={chartInstant}
						catalogue={catalogue.data}
					/>
				</>
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
