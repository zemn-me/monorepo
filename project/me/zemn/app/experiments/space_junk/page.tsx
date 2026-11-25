import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { catalogueUrl } from './assets.js';
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
	const [originals, setOriginals] = useState(false);
	const objects = originals ? catalogue.originals : catalogue.objects;
	const { count, featured } = useMemo(
		() => readChart(objects, birthday),
		[objects, birthday]
	);
	const lead = featured[0]?.object;
	const population = originals
		? `${count} of Carrie’s three ${count === 1 ? 'was' : 'were'}`
		: `${count.toLocaleString('en-GB')} catalogued ${count === 1 ? 'object was' : 'objects were'}`;
	if (birthday.toString() > catalogue.asOf)
		return (
			<p role="status">
				Choose a date on or before {displayDate(catalogue.asOf)}, the
				date of this catalog edition.
			</p>
		);
	return (
		<>
			<label className={style.collection}>
				Collection
				<select
					value={originals ? 'original' : 'catalogue'}
					onChange={e => setOriginals(e.target.value === 'original')}
				>
					<option value="catalogue">Full debris catalog</option>
					<option value="original">Carrie’s original three</option>
				</select>
			</label>
			<figure className={style.plate}>
				<Wheel
					birthday={birthday}
					objects={featured.map(row => row.object)}
				/>
				<figcaption aria-live="polite">
					<time dateTime={birthday.toString()}>
						✦ {displayDate(birthday.toString())}
					</time>
					<h2>
						{lead?.id === 29257
							? 'The spacewalk spatula'
							: (lead?.name ?? 'A quiet sky')}
					</h2>
					{lead?.id === 29257 && (
						<p>
							There was a spatula in orbit the day you were born.
						</p>
					)}
					<p>
						{lead
							? `${population} in Earth orbit that day.`
							: 'No pieces with confirmed dates in this collection were in orbit on your birthday.'}
					</p>
					{lead && (
						<small>
							{lead.eva
								? 'Lost or discarded on a spacewalk'
								: kinds[lead.kind]}
						</small>
					)}
				</figcaption>
			</figure>
			{lead && (
				<>
					<h2 className={style.sectionTitle}>Your objects</h2>
					<p>
						{originals
							? 'The objects from Carrie’s original chart that were in orbit on your birthday.'
							: 'One from each available class, matched by release anniversary. Spacewalk equipment gets first pick.'}
					</p>
					<ul className={style.catalogue}>
						{featured.map(({ object, days }) => (
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
					<Sky
						birthday={birthday.toString()}
						objects={featured.map(row => row.object)}
					/>
				</>
			)}
		</>
	);
}

export default function Page() {
	const [birthday, setBirthday] = useState<Temporal.PlainDate>();
	const input = useRef<HTMLInputElement>(null);
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
			<form
				className={style.form}
				onSubmit={event => {
					event.preventDefault();
					if (input.current)
						setBirthday(
							Temporal.PlainDate.from(input.current.value)
						);
				}}
			>
				<label>
					Your birthday
					<input
						type="date"
						required
						ref={input}
						min="0001-01-01"
						max={catalogue.data?.asOf ?? '9999-12-31'}
					/>
				</label>
				<button type="submit">Draw my chart</button>
				<button
					type="button"
					className={style.example}
					onClick={() => {
						if (input.current) input.current.value = '2006-08-01';
						setBirthday(Temporal.PlainDate.from('2006-08-01'));
					}}
				>
					Try 1 August 2006
				</button>
			</form>
			{!birthday ? (
				<figure className={style.plate}>
					<Wheel objects={[]} />
					<figcaption>
						<h2>The orbital calendar</h2>
						<p>
							Your star marks your birthday. Each symbol marks the
							anniversary of a piece breaking free.
						</p>
					</figcaption>
				</figure>
			) : catalogue.data ? (
				<BirthdayChart birthday={birthday} catalogue={catalogue.data} />
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
