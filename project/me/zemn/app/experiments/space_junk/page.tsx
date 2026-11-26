import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	parseAsArrayOf,
	parseAsString,
	parseAsStringLiteral,
	useQueryState,
} from 'nuqs';
import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { flushSync } from 'react-dom';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayRulers } from './birthday_form.js';
import { BodyFilters } from './body_filters.js';
import { catalogueDate } from './catalogue_date.js';
import { type Catalogue, kinds, readChart, type SpaceObject } from './chart.js';
import {
	birthInstant,
	catalogueId,
	objectAnchor,
	objectFromHash,
} from './chart_query.js';
import { ChartViewer } from './chart_viewer.js';
import { type City, cityShard, lookupCity, sharedCityShard } from './cities.js';
import { CitySearch } from './city_search.js';
import { PlacementEntry } from './placement_entry.js';
import { bodyPositions, classical, modern, planetGlyphs } from './planets.js';
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
const bodyList = parseAsArrayOf(
	parseAsStringLiteral(planetaryBodies)
).withDefault([...classical]);
const kindList = parseAsArrayOf(
	parseAsStringLiteral(artificialTypes)
).withDefault([...debrisTypes]);
const searchText = parseAsString.withDefault('motor');
type ObjectKind = SpaceObject['kind'];

const BirthdayChart = memo(function BirthdayChart({
	catalogue,
	instant,
	zone,
	place,
	cityRevision,
	selectedKinds,
	setSelectedKinds,
	catalogueFailed,
	retryCatalogue,
}: {
	catalogue?: Catalogue;
	instant: number;
	zone: string;
	place?: Birthplace;
	cityRevision: number;
	selectedKinds: readonly ObjectKind[];
	setSelectedKinds: (value: ObjectKind[]) => void;
	catalogueFailed: boolean;
	retryCatalogue: () => void;
}) {
	const hasObjects = selectedKinds.length > 0;
	const [search, setSearch] = useQueryState('q', searchText);
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
	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return matches;
		return matches.filter(({ object }) =>
			`${object.name} ${object.piece} ${object.id} ${kinds[object.kind]}`
				.toLowerCase()
				.includes(term)
		);
	}, [matches, search]);
	const coverage = useDebrisPositions(filtered, instant, day, catalogueDate);
	const { instant: debrisInstant } = coverage;
	const filteredIds = useMemo(
		() => new Set(filtered.map(({ object }) => object.id)),
		[filtered]
	);
	const markers = useMemo(
		() =>
			coverage.markers.filter(({ object }) => filteredIds.has(object.id)),
		[coverage.markers, filteredIds]
	);
	const [selectedBodies, setSelectedBodies] = useQueryState(
		'bodies',
		bodyList
	);
	const bodies = useMemo(
		() => bodyPositions(selectedBodies, new Date(instant), place),
		[selectedBodies, instant, place]
	);
	const [legacyId] = useQueryState('object', catalogueId);
	const [revision, setRevision] = useState(0);
	const [anchorId, setAnchorId] = useState<number | null>(null);
	useEffect(() => {
		const readHash = () =>
			setAnchorId(objectFromHash(window.location.hash));
		readHash();
		window.addEventListener('hashchange', readHash);
		return () => window.removeEventListener('hashchange', readHash);
	}, []);
	const selectedId = anchorId ?? legacyId;
	function revisit() {
		setRevision(previous => previous + 1);
	}
	function locate(id: number) {
		const hash = '#' + objectAnchor(id);
		if (window.location.hash === hash) revisit();
		else window.location.hash = hash;
	}
	const byId = useMemo(
		() => new Map(markers.map(m => [m.object.id, m])),
		[markers]
	);
	const selected = selectedId === null ? undefined : byId.get(selectedId);
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
	const pageCount = Math.ceil(plotted.length / pageSize);
	const pageIndex = Math.min(page, Math.max(0, pageCount - 1));
	const offset = pageIndex * pageSize;
	const [printing, setPrinting] = useState(false);
	useEffect(() => {
		// The browser snapshots the DOM immediately after beforeprint returns.
		const before = () => flushSync(() => setPrinting(true));
		const after = () => setPrinting(false);
		window.addEventListener('beforeprint', before);
		window.addEventListener('afterprint', after);
		return () => {
			window.removeEventListener('beforeprint', before);
			window.removeEventListener('afterprint', after);
		};
	}, []);
	const rows = printing ? plotted : plotted.slice(offset, offset + pageSize);

	return (
		<>
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
					revision={revision}
					linkedId={anchorId}
					cityRevision={cityRevision}
					zodiac={debrisZodiac}
					ascendant={natalZodiac.ascendant}
					onSelect={m => locate(m.object.id)}
				>
					<BodyFilters
						group="Planetary bodies"
						presetName="Zodiac"
						preset={classical}
						options={planetaryBodies}
						glyphs={planetGlyphs}
						selected={selectedBodies}
						onChange={setSelectedBodies}
					/>
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
					>
						<input
							className={style.search}
							type="search"
							aria-label="Search by name, catalog number, designator or object type"
							placeholder="Search"
							value={search}
							onChange={event => {
								setSearch(event.target.value);
								setPage(0);
							}}
						/>
					</BodyFilters>
				</ChartViewer>
			</figure>
			{hasObjects && catalogueFailed && !catalogue && (
				<p role="alert">
					Orbiting objects unavailable.{' '}
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
			<div>
				{(bodies.length > 0 ||
					natalZodiac.ascendant !== undefined ||
					rows.length > 0) && (
					<ul
						className={style.placements}
						aria-label="Chart placements"
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
						{rows.map(({ object }) => {
							const { longitude } = debrisZodiac.direction(
								byId.get(object.id)!.fixed
							);
							return (
								<PlacementEntry
									key={object.id}
									name={object.name}
									designator={object.piece}
									longitude={longitude}
									house={debrisZodiac.house(longitude)}
									target={objectAnchor(object.id)}
									onRevisit={revisit}
								/>
							);
						})}
					</ul>
				)}
				{hasObjects && catalogue && !rows.length && (
					<p role="status">
						{filtered.length && coverage.pending
							? 'Locating objects…'
							: 'No matching objects on the chart'}
					</p>
				)}
				{pageCount > 1 && (
					<nav className={style.paging} aria-label="Chart placement pages">
						<button
							type="button"
							aria-label="Previous page"
							disabled={!pageIndex}
							onClick={() => setPage(pageIndex - 1)}
						>
							←
						</button>
						<span role="status">Pg. {pageIndex + 1}/{pageCount}</span>
						<button
							type="button"
							aria-label="Next page"
							disabled={pageIndex + 1 === pageCount}
							onClick={() => setPage(pageIndex + 1)}
						>
							→
						</button>
					</nav>
				)}
			</div>
		</>
	);
});

export default function Page() {
	const [instant, setInstant] = useQueryState('time', birthInstant);
	const clock = useRulerClock(instant, setInstant);
	const [selectedKinds, setSelectedKinds] = useQueryState('kinds', kindList);
	const [deviceZone, setDeviceZone] = useState<string>();
	useEffect(
		() => setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
		[]
	);
	const [cityKey, setCityKey] = useQueryState('city', parseAsString);
	const [cityRevision, setCityRevision] = useState(0);
	const client = useQueryClient();
	const birthplace = useQuery({
		queryKey: ['birth-city', cityKey],
		enabled: cityKey !== null,
		staleTime: Infinity,
		retry: false,
		meta: { persist: false },
		queryFn: async () => {
			const rows = await client.ensureQueryData(
				cityShard(sharedCityShard(cityKey!))
			);
			return lookupCity(rows, cityKey!);
		},
	});
	const city = birthplace.data;
	useEffect(() => {
		if (city && cityKey !== city.key) {
			client.setQueryData(['birth-city', city.key], city);
			void setCityKey(city.key);
		}
	}, [city, cityKey, client, setCityKey]);
	const zone = city?.timezone ?? deviceZone ?? 'UTC';
	const chart = useDeferredValue(
		useMemo(
			() => ({ instant, zone, place: city, cityRevision }),
			[instant, zone, city, cityRevision]
		)
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
			if (next) client.setQueryData(['birth-city', next.key], next);
			void setCityKey(next?.key ?? null);
			setCityRevision(revision => revision + 1);
		},
		[clock, deviceZone, zone, setCityKey, client]
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
			<h1>Astrological Chart</h1>
			<CitySearch city={city} onSelect={setBirthplace} />
			{cityKey !== null && birthplace.isError && (
				<p role="alert">
					Birth city unavailable.{' '}
					<button
						type="button"
						onClick={() => void birthplace.refetch()}
					>
						Retry
					</button>
				</p>
			)}
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
							<a href="https://www.geonames.org/">GeoNames</a> ·{' '}
							<a href="https://creativecommons.org/licenses/by/4.0/">
								CC BY 4.0
							</a>
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
						<dt>Orbiting objects</dt>
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
	title: 'Astrological Chart',
	description:
		'Plot the Sun, Moon, planets, and space junk for your birthday.',
};
export const handle = { metadata };
