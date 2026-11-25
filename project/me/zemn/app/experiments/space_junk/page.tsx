import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
import { BirthdayForm } from './birthday_form.js';
import { type Catalogue, kinds, readChart } from './chart.js';
import { Sky } from './sky.js';
import style from './style.module.css';
import { ObjectGlyph, Wheel } from './wheel.js';

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
	const { matches, releases } = useMemo(
		() => readChart(catalogue.objects, birthday),
		[catalogue, birthday]
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
			<figure className={style.plate}>
				<Wheel birthday={birthday} releases={releases} />
				<figcaption aria-live="polite">
					<time dateTime={birthday.toString()}>
						✦ {displayDate(birthday.toString())}
					</time>
					<h2>
						{count
							? `${count.toLocaleString('en-GB')} ${count === 1 ? 'object' : 'objects'} in orbit`
							: 'A quiet sky'}
					</h2>
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
						<small>
							The gold star marks your birthday. Taller columns
							mean more pieces share that release anniversary.
							Drag the calendar to rotate it.
						</small>
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
						<span role="status">
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
				Find the spent rockets, loose equipment and satellite fragments
				that shared your birthday in Earth orbit.
			</p>
			<BirthdayForm asOf={catalogue.data?.asOf} onDraw={setBirthday} />
			{!birthday ? (
				<figure className={style.plate}>
					<Wheel />
					<figcaption>
						<h2>The orbital calendar</h2>
						<p>
							Drag to turn the calendar. Enter your birthday to
							see the release anniversaries rise around the globe.
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
					` Edition of ${displayDate(catalogue.data.asOf)}.`}
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
