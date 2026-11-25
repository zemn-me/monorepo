import {
	faDharmachakra,
	faEarthAmericas,
	faEllipsis,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from '@tanstack/react-query';
import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useLocale } from '#root/ts/react/lang/useLocale.js';
import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayRulers } from './birthday_form.js';
import { ChartSettings } from './birthplace.js';
import { catalogueDate } from './catalogue_date.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { Globe } from './globe.js';
import { groundLocation } from './globe_geometry.js';
import { bodyPositions, classical, modern, type ChartBody } from './planets.js';
import { Sky } from './sky.js';
import style from './style.module.css';
import { useDebrisPositions } from './use_debris_positions.js';
import { type Birthplace, zodiacFrame } from './zodiac.js';
import { ZodiacWheel } from './zodiac_wheel.js';

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
	junk,
	setJunk,
	catalogueFailed,
	retryCatalogue,
}: {
	catalogue?: Catalogue;
	instant: number;
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
	const time = iso.slice(11, 19);
	const matches = useMemo(
		() =>
			junk && catalogue
				? readChart(catalogue.objects, Temporal.PlainDate.from(day))
						.matches
				: [],
		[catalogue, day, junk]
	);
	const coverage = useDebrisPositions(matches, instant, day, catalogueDate);
	const { markers } = coverage;
	const [view, setView] = useState<'wheel' | 'earth'>('wheel');
	const [place, setPlace] = useState<Birthplace>();
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
	const zodiac = useMemo(
		() => zodiacFrame(new Date(instant), place),
		[instant, place]
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
			<div className={style.chartToolbar}>
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
						<FontAwesomeIcon
							icon={faDharmachakra}
							aria-hidden="true"
						/>
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
				{view === 'wheel' ? (
					<ZodiacWheel
						bodies={bodies}
						placements={placements}
						ascendant={zodiac.ascendant}
						selected={focus}
						onSelect={m => locate(m.object.id)}
					/>
				) : (
					<Globe
						key={selection?.revision}
						instant={instant}
						bodies={bodies}
						showSigns={traditional}
						markers={markers}
						selected={selected}
						onSelect={m => locate(m.object.id)}
					/>
				)}

				<figcaption aria-live="polite" className={style.caption}>
					<time dateTime={iso}>
						{Temporal.PlainDate.from(day).toLocaleString(
							languages,
							{ dateStyle: 'long', calendar: 'gregory' }
						)}
					</time>
					{' · '}
					{time} UTC
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
								{markers.length
									? `${markers.length.toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} objects located`
									: coverage.pending
										? 'Loading orbital positions…'
										: 'No archived positions available for this time.'}
							</p>
						))}
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
							observer={place && { ...place, instant }}
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
	const [instant, setInstant] = useState(() =>
		Date.parse('2006-08-01T12:00:00Z')
	);
	const [junk, setJunk] = useState(true);
	const chartInstant = useDeferredValue(instant);

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
			<BirthdayRulers
				epoch={instant}
				asOf={catalogueDate}
				onChange={setInstant}
			/>
			<BirthdayChart
				instant={chartInstant}
				catalogue={catalogue.data}
				junk={junk}
				setJunk={setJunk}
				catalogueFailed={catalogue.isError}
				retryCatalogue={catalogue.refetch}
			/>
			<details className={style.disclosure}>
				<summary>Sources</summary>
				<p>
					The tropical zodiac divides the ecliptic into twelve equal
					signs. Zodiac shows the Sun, Moon and five classical
					planets. Add Uranus, Neptune or Pluto under More bodies.
					Positions come from{' '}
					<a href="https://github.com/cosinekitty/astronomy">
						Astronomy Engine
					</a>
					. Lines on the wheel show major aspects within 6°. The globe
					marks their sky directions on a reference sphere. Dashed
					arcs and hollow dots indicate directions behind Earth.
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
