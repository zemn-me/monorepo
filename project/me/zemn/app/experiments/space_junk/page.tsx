import { useQuery } from '@tanstack/react-query';
import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayRulers } from './birthday_form.js';
import { BodyFilters } from './body_filters.js';
import { catalogueDate } from './catalogue_date.js';
import { type Catalogue, kinds, readChart, type SpaceObject } from './chart.js';
import { ChartViewer } from './chart_viewer.js';
import type { City } from './cities.js';
import { CitySearch } from './city_search.js';
import { PlacementEntry } from './placement_entry.js';
import {
	bodyPositions,
	type ChartBody,
	classical,
	modern,
	planetGlyphs,
} from './planets.js';
import { firstInstant, zonedTime } from './ruler_time.js';
import style from './style.module.css';
import { useDebrisPositions } from './use_debris_positions.js';
import { useRulerClock } from './use_ruler_clock.js';
import { type Birthplace, zodiacFrame } from './zodiac.js';

function displayDate(day: string) {
	return Temporal.PlainDate.from(day.slice(0, 10)).toLocaleString('en-GB', {
		dateStyle: 'long',
	});
}

const debrisTypes = ['C', 'D', 'R'] as const;
const artificialTypes = [...debrisTypes, 'P'] as const;
const typeLabels = {
	C: 'Discarded equipment',
	D: 'Breakup fragments',
	R: 'Rocket stages',
	P: 'Spacecraft payloads',
};
const planetaryBodies = [...classical, ...modern];
type ObjectKind = SpaceObject['kind'];

const BirthdayChart = memo(function BirthdayChart({
	catalogue,
	instant,
	zone,
	place,
	selectedKinds,
	setSelectedKinds,
	catalogueFailed,
	retryCatalogue,
}: {
	catalogue?: Catalogue;
	instant: number;
	zone: string;
	place?: Birthplace;
	selectedKinds: readonly ObjectKind[];
	setSelectedKinds: (value: ObjectKind[]) => void;
	catalogueFailed: boolean;
	retryCatalogue: () => void;
}) {
	const hasObjects = selectedKinds.length > 0;
	const [search, setSearch] = useState('spatula');
	const [page, setPage] = useState(0);
	const day = new Date(instant).toISOString().slice(0, 10);
	const birthday = zonedTime(instant, zone).toPlainDate().toString();
	const selectedObjects = useMemo(
		() =>
			catalogue?.objects.filter(object =>
				selectedKinds.includes(object.kind)
			) ?? [],
		[catalogue, selectedKinds]
	);
	const matches = useMemo(
		() =>
			readChart(selectedObjects, Temporal.PlainDate.from(birthday), day)
				.matches,
		[selectedObjects, birthday, day]
	);
	const coverage = useDebrisPositions(matches, instant, day, catalogueDate);
	const { instant: debrisInstant } = coverage;
	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return matches;
		return matches.filter(({ object }) =>
			`${object.name} ${object.piece} ${object.id} ${kinds[object.kind]}`
				.toLowerCase()
				.includes(term)
		);
	}, [matches, search]);
	const filteredIds = useMemo(
		() => new Set(filtered.map(({ object }) => object.id)),
		[filtered]
	);
	const markers = useMemo(
		() =>
			coverage.markers.filter(({ object }) => filteredIds.has(object.id)),
		[coverage.markers, filteredIds]
	);
	const [selectedBodies, setSelectedBodies] =
		useState<readonly ChartBody[]>(classical);
	const bodies = useMemo(
		() => bodyPositions(selectedBodies, new Date(instant), place),
		[selectedBodies, instant, place]
	);
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
	const debrisZodiac = useMemo(
		() => zodiacFrame(new Date(debrisInstant), place),
		[debrisInstant, place]
	);
	const natalZodiac = useMemo(
		() =>
			place && debrisInstant !== instant
				? zodiacFrame(new Date(instant), place)
				: debrisZodiac,
		[place, debrisInstant, instant, debrisZodiac]
	);
	const plotted = useMemo(
		() => filtered.filter(({ object }) => byId.has(object.id)),
		[filtered, byId]
	);
	const pageSize = 12;
	const pageIndex = Math.min(
		page,
		Math.max(0, Math.ceil(plotted.length / pageSize) - 1)
	);
	const offset = pageIndex * pageSize;
	const rows = plotted.slice(offset, offset + pageSize);

	return (
		<>
			<BodyFilters
				grouped
				group="Planetary bodies"
				presetName="Zodiac"
				preset={classical}
				options={planetaryBodies}
				glyphs={planetGlyphs}
				selected={selectedBodies}
				onChange={setSelectedBodies}
			/>
			<figure className={style.figure}>
				<ChartViewer
					instant={instant}
					bodies={bodies}
					showSigns={classical.some(body =>
						selectedBodies.includes(body)
					)}
					birthplace={place}
					markers={markers}
					selected={selected}
					revision={selection?.revision}
					zodiac={debrisZodiac}
					ascendant={natalZodiac.ascendant}
					onSelect={m => locate(m.object.id)}
				/>
			</figure>
			{hasObjects && catalogueFailed && !catalogue && (
				<p role="alert">
					Object catalogue unavailable.{' '}
					<button type="button" onClick={retryCatalogue}>
						Retry
					</button>
				</p>
			)}
			{filtered.length > 0 &&
				!markers.length &&
				coverage.failed &&
				!coverage.pending && (
					<p role="alert">
						Orbit archive unavailable.{' '}
						<button type="button" onClick={coverage.retry}>
							Retry
						</button>
					</p>
				)}
			<section
				className={style.objectCatalogue}
				aria-labelledby="object-catalogue"
			>
				<div className={style.catalogueHeading}>
					<h2 id="object-catalogue">Object catalogue</h2>
					<BodyFilters
						group="Man-made bodies"
						presetName="Space junk"
						preset={debrisTypes}
						options={artificialTypes}
						labels={typeLabels}
						selected={selectedKinds}
						onChange={next => {
							setSelectedKinds(next);
							setPage(0);
						}}
					/>
				</div>
				{hasObjects && catalogue && (
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
				)}
				{(bodies.length > 0 || natalZodiac.ascendant !== undefined) && (
					<ul
						className={style.catalogue}
						aria-label="Natal placements"
					>
						{bodies.map(body => (
							<PlacementEntry
								key={body.name}
								name={body.name}
								glyph={body.glyph}
								longitude={body.longitude}
								house={natalZodiac.house(body.longitude)}
							/>
						))}
						{natalZodiac.ascendant !== undefined && (
							<PlacementEntry
								name="Rising sign"
								longitude={natalZodiac.ascendant}
								house={natalZodiac.house(natalZodiac.ascendant)}
							/>
						)}
					</ul>
				)}
				{hasObjects && catalogue && (
					<>
						<div className={style.paging}>
							<span role="status" aria-label="Catalogue results">
								{rows.length
									? `${(offset + 1).toLocaleString('en-GB')}–${(offset + rows.length).toLocaleString('en-GB')} of ${plotted.length.toLocaleString('en-GB')} orbiting objects`
									: filtered.length && coverage.pending
										? 'Locating objects…'
										: 'No matching objects on the chart'}
							</span>
							{plotted.length > pageSize && (
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
											offset + rows.length >=
											plotted.length
										}
										onClick={() => setPage(pageIndex + 1)}
									>
										Next
									</button>
								</>
							)}
						</div>
						<ul
							className={style.catalogue}
							aria-label="Objects in orbit"
						>
							{rows.map(({ object, days }) => {
								const { longitude } = debrisZodiac.direction(
									byId.get(object.id)!.fixed
								);
								return (
									<PlacementEntry
										key={object.id}
										name={object.name}
										longitude={longitude}
										house={debrisZodiac.house(longitude)}
										locate={() => locate(object.id)}
									>
										<p>
											{kinds[object.kind]} ·{' '}
											{object.piece} · NORAD {object.id}
										</p>
										<p>
											{displayDate(object.start)} –{' '}
											{displayDate(
												object.end ?? catalogue.asOf
											)}{' '}
											·{' '}
											{days === 0
												? 'Shares your birthday'
												: `Release anniversary ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} your birthday`}
										</p>
									</PlacementEntry>
								);
							})}
						</ul>
					</>
				)}
			</section>
		</>
	);
});

export default function Page() {
	const { instant, clock } = useRulerClock(Date.UTC(2006, 7, 1, 12));
	const [selectedKinds, setSelectedKinds] =
		useState<readonly ObjectKind[]>(debrisTypes);
	const [deviceZone, setDeviceZone] = useState<string>();
	useEffect(
		() => setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
		[]
	);
	const [city, setCity] = useState<City>();
	const zone = city?.timezone ?? deviceZone ?? 'UTC';
	const chart = useDeferredValue(
		useMemo(() => ({ instant, zone, place: city }), [instant, zone, city])
	);

	const setBirthplace = useCallback(
		(next?: City) => {
			const nextZone = next?.timezone ?? deviceZone ?? 'UTC';
			// A birthday is entered as a wall time, so changing the city keeps the
			// date and clock reading and resolves them to an instant in the new zone.
			if (nextZone !== zone)
				clock.commit(
					Math.max(
						firstInstant,
						Math.min(
							Date.parse(catalogueDate + 'T23:59:59.999Z'),
							zonedTime(clock.read(), zone)
								.toPlainDateTime()
								.toZonedDateTime(nextZone).epochMilliseconds
						)
					)
				);
			setCity(next);
		},
		[clock, deviceZone, zone]
	);

	const catalogue = useQuery({
		queryKey: ['space-junk-catalogue', catalogueUrl],
		enabled: selectedKinds.length > 0,
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
			<h1>Star Chart</h1>
			<CitySearch city={city} onSelect={setBirthplace} />
			<BirthdayRulers
				epoch={instant}
				asOf={catalogueDate}
				zone={city?.timezone ?? deviceZone}
				clock={clock}
			/>
			<BirthdayChart
				{...chart}
				catalogue={catalogue.data}
				selectedKinds={selectedKinds}
				setSelectedKinds={setSelectedKinds}
				catalogueFailed={catalogue.isError}
				retryCatalogue={catalogue.refetch}
			/>
			<section className={style.sources} aria-labelledby="chart-sources">
				<h2 id="chart-sources">Sources</h2>
				<dl>
					<div>
						<dt>Birth cities</dt>
						<dd>
							<a href="https://open-meteo.com/en/docs/geocoding-api">
								Open-Meteo
							</a>{' '}
							and <a href="https://www.geonames.org/">GeoNames</a>
						</dd>
					</div>
					<div>
						<dt>Planet positions</dt>
						<dd>
							<a href="https://github.com/cosinekitty/astronomy">
								Astronomy Engine
							</a>
						</dd>
					</div>
					<div>
						<dt>Houses</dt>
						<dd>
							<a href="https://www.astro.com/astrowiki/en/Porphyry_House_System">
								Porphyry house system
							</a>
						</dd>
					</div>
					<div>
						<dt>Object catalogue</dt>
						<dd>
							<a href="https://planet4589.org/space/gcat/">
								Jonathan McDowell’s General Catalog of
								Artificial Space Objects
							</a>
							{catalogue.data &&
								` · ${displayDate(catalogue.data.asOf)}`}{' '}
							·{' '}
							<a href="https://creativecommons.org/licenses/by/4.0/">
								CC BY 4.0
							</a>
						</dd>
					</div>
					<div>
						<dt>Orbital elements</dt>
						<dd>
							<a href="https://spacebook.com/">
								COMSPOC Spacebook
							</a>
						</dd>
					</div>
					<div>
						<dt>Coastlines</dt>
						<dd>
							<a href="https://www.naturalearthdata.com/">
								Natural Earth
							</a>
						</dd>
					</div>
				</dl>
			</section>
		</article>
	);
}
export const metadata: Metadata = {
	title: 'Star Chart',
	description:
		'Plot the Sun, Moon, planets, and space junk for your birthday.',
};
export const handle = { metadata };
