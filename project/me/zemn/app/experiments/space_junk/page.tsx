import { faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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

import { useLocale } from '#root/ts/react/lang/useLocale.js';
import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayRulers } from './birthday_form.js';
import { ChartSettings } from './birthplace.js';
import { catalogueDate } from './catalogue_date.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { ChartViewer } from './chart_viewer.js';
import type { City } from './cities.js';
import { CitySearch } from './city_search.js';
import { groundLocation } from './globe_geometry.js';
import { bodyPositions, type ChartBody, classical, modern } from './planets.js';
import { firstInstant, zonedTime } from './ruler_time.js';
import { Sky } from './sky.js';
import style from './style.module.css';
import { useDebrisPositions } from './use_debris_positions.js';
import { useRulerClock } from './use_ruler_clock.js';
import { type Birthplace, zodiacFrame } from './zodiac.js';

function displayDate(day: string) {
	return Temporal.PlainDate.from(day.slice(0, 10)).toLocaleString('en-GB', {
		dateStyle: 'long',
	});
}

function LayerSwitch({
	label,
	checked,
	onChange,
	title,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	title?: string;
}) {
	return (
		<label className={style.switch} title={title}>
			<input
				type="checkbox"
				role="switch"
				checked={checked}
				onChange={e => onChange(e.currentTarget.checked)}
			/>
			{label}
		</label>
	);
}

const BirthdayChart = memo(function BirthdayChart({
	catalogue,
	instant,
	zone,
	place,
	onPlace,
	junk,
	setJunk,
	catalogueFailed,
	retryCatalogue,
}: {
	catalogue?: Catalogue;
	instant: number;
	zone: string;
	place?: Birthplace;
	onPlace: (place?: Birthplace) => void;
	junk: boolean;
	setJunk: (value: boolean) => void;
	catalogueFailed: boolean;
	retryCatalogue: () => void;
}) {
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const languages = useLocale();
	const iso = new Date(instant).toISOString();
	const day = iso.slice(0, 10);
	const birthday = zonedTime(instant, zone).toPlainDate().toString();
	const localFormat = useMemo(
		() =>
			new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				dateStyle: 'long',
				timeStyle: 'long',
				timeZone: zone,
			}),
		[languages, zone]
	);
	const matches = useMemo(
		() =>
			junk && catalogue
				? readChart(
						catalogue.objects,
						Temporal.PlainDate.from(birthday),
						day
					).matches
				: [],
		[catalogue, birthday, day, junk]
	);
	const coverage = useDebrisPositions(matches, instant, day, catalogueDate);
	const { markers, instant: debrisInstant } = coverage;
	const [traditional, setTraditional] = useState(true);
	const [more, setMore] = useState(false);
	const [extra, setExtra] = useState<ChartBody[]>([]);
	const bodies = useMemo(
		() =>
			bodyPositions(
				[...(traditional ? classical : []), ...extra],
				new Date(instant),
				place
			),
		[traditional, extra, instant, place]
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
	const ascendant = useMemo(
		() =>
			place && debrisInstant !== instant
				? zodiacFrame(new Date(instant), place).ascendant
				: debrisZodiac.ascendant,
		[place, debrisInstant, instant, debrisZodiac]
	);
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
				className={style.layers}
				role="group"
				aria-label="Chart layers"
			>
				<LayerSwitch
					label="Zodiac"
					checked={traditional}
					onChange={setTraditional}
					title="Sun, Moon, Mercury, Venus, Mars, Jupiter and Saturn"
				/>
				<LayerSwitch
					label="Space junk"
					checked={junk}
					onChange={setJunk}
				/>
				<button
					type="button"
					title="More bodies"
					aria-label="More bodies"
					aria-expanded={more}
					aria-controls="additional-chart-bodies"
					onClick={() => setMore(!more)}
				>
					<FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
				</button>
			</div>
			<div id="additional-chart-bodies" hidden={!more}>
				<div
					className={style.extraBodies}
					role="group"
					aria-label="Additional bodies"
				>
					{modern.map(body => (
						<LayerSwitch
							key={body}
							label={body}
							checked={extra.includes(body)}
							onChange={on =>
								setExtra(current =>
									on
										? [...current, body]
										: current.filter(b => b !== body)
								)
							}
						/>
					))}
				</div>
			</div>
			<figure className={style.figure}>
				<ChartViewer
					instant={instant}
					bodies={bodies}
					showSigns={traditional}
					birthplace={place}
					markers={markers}
					selected={selected}
					revision={selection?.revision}
					zodiac={debrisZodiac}
					ascendant={ascendant}
					onSelect={m => locate(m.object.id)}
				/>
				<figcaption aria-live="polite" className={style.caption}>
					<time dateTime={iso}>{localFormat.format(instant)}</time>
					{junk &&
						(!catalogue ? (
							catalogueFailed ? (
								<p role="alert">
									Debris catalogue unavailable.{' '}
									<button
										type="button"
										onClick={retryCatalogue}
									>
										Retry
									</button>
								</p>
							) : (
								<p role="status">Loading debris catalogue…</p>
							)
						) : !count ? (
							<p>No catalogued debris in orbit on this date.</p>
						) : !markers.length &&
							coverage.failed &&
							!coverage.pending ? (
							<p role="alert">
								Orbit archive unavailable.{' '}
								<button type="button" onClick={coverage.retry}>
									Retry
								</button>
							</p>
						) : (
							<p role="status" aria-label="Chart coverage">
								{debrisInstant !== instant ? (
									<>
										Updating debris… Showing{' '}
										<time
											dateTime={new Date(
												debrisInstant
											).toISOString()}
										>
											{localFormat.format(debrisInstant)}
										</time>
									</>
								) : markers.length ? (
									`${markers.length.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} objects located`
								) : coverage.pending ? (
									'Loading orbital positions…'
								) : (
									'No archived positions available for this time.'
								)}
							</p>
						))}
					{location && selected && (
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
				ascendant={ascendant}
				onPlace={onPlace}
			/>
			{junk && catalogue && (
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
							observer={place && { ...place, instant, zone }}
							objects={rows.map(row => row.object)}
						/>
					)}

					<ul
						className={style.catalogue}
						aria-label="Objects in orbit"
					>
						{rows.map(({ object, days }) => (
							<li key={object.id}>
								<h3>
									{byId.has(object.id) ? (
										<a
											href="#star-chart"
											onClick={() => locate(object.id)}
										>
											{object.name}
										</a>
									) : (
										object.name
									)}
								</h3>
								<p>
									{kinds[object.kind]} · {object.piece} ·
									NORAD {object.id}
								</p>
								<p>
									{displayDate(object.start)} –{' '}
									{displayDate(object.end ?? catalogue.asOf)}{' '}
									·{' '}
									{days === 0
										? 'Shares your birthday'
										: `Release anniversary ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} your birthday`}
								</p>
							</li>
						))}
					</ul>
				</details>
			)}
		</>
	);
});

export default function Page() {
	const { instant, clock } = useRulerClock(Date.UTC(2006, 7, 1, 12));
	const [junk, setJunk] = useState(true);
	const [deviceZone, setDeviceZone] = useState('UTC');
	useEffect(
		() => setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
		[]
	);
	const [place, setPlace] = useState<City | Birthplace>();
	const city = place && 'timezone' in place ? place : undefined;
	const zone = city?.timezone ?? deviceZone;
	const chart = useDeferredValue(
		useMemo(() => ({ instant, zone, place }), [instant, zone, place])
	);

	const setBirthplace = useCallback(
		(next?: Birthplace | City) => {
			const nextZone =
				next && 'timezone' in next ? next.timezone : deviceZone;
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
			setPlace(next);
		},
		[clock, deviceZone, zone]
	);

	const catalogue = useQuery({
		queryKey: ['space-junk-catalogue', catalogueUrl],
		enabled: junk,
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
				zone={zone}
				clock={clock}
			/>
			<BirthdayChart
				{...chart}
				onPlace={setBirthplace}
				catalogue={catalogue.data}
				junk={junk}
				setJunk={setJunk}
				catalogueFailed={catalogue.isError}
				retryCatalogue={catalogue.refetch}
			/>
			<details className={style.disclosure}>
				<summary>Sources</summary>
				<p>
					Birthplace search uses{' '}
					<a href="https://open-meteo.com/en/docs/geocoding-api">
						Open-Meteo
					</a>{' '}
					and <a href="https://www.geonames.org/">GeoNames</a>.
				</p>
				<p>
					The tropical zodiac divides the ecliptic into twelve equal
					signs. Zodiac shows the Sun, Moon and five classical
					planets. Add Uranus, Neptune or Pluto under More bodies.
					Positions come from{' '}
					<a href="https://github.com/cosinekitty/astronomy">
						Astronomy Engine
					</a>
					. Face-on, lines show major aspects within 6°. Tilting the
					chart places debris at its orbital position and planets on a
					reference sphere. Dashed arcs and hollow dots indicate
					directions behind Earth.
				</p>
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
	title: 'Star Chart',
	description:
		'Plot the Sun, Moon, planets, and space junk for your birthday.',
};
export const handle = { metadata };
