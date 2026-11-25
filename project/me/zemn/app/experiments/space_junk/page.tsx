import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { Metadata } from '#root/ts/remix/metadata.js';
import { daysFromBirthday, objects, readChart } from './chart.js';
import style from './style.module.css';
import { ObjectGlyph, Wheel } from './wheel.js';

function displayDate(date: Temporal.PlainDate) {
	return date.toLocaleString('en-GB', { dateStyle: 'long' });
}

function anniversaryLabel(days: number) {
	if (days === 0) return 'Shares your birthday';
	const count = Math.abs(days);
	return `${count} ${count === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} your birthday`;
}

export default function Page() {
	const [birthday, setBirthday] = useState<Temporal.PlainDate>();
	const nearest = birthday ? readChart(birthday) : [];
	return (
		<article className={style.page}>
			<h1>
				Space junk <i>star chart</i>
			</h1>
			<p className={style.intro}>
				Which piece of Carrie’s space junk shares your corner of the
				calendar? Find your sign among three launch anniversaries.
			</p>
			<form
				className={style.form}
				onSubmit={event => {
					event.preventDefault();
					const input =
						event.currentTarget.elements.namedItem('birthday');
					if (input instanceof HTMLInputElement) {
						setBirthday(Temporal.PlainDate.from(input.value));
					}
				}}
			>
				<label>
					Your birthday
					<input
						type="date"
						id="birthday"
						required
						ref={input => {
							if (input)
								input.max =
									Temporal.Now.plainDateISO().toString();
						}}
					/>
				</label>
				<button type="submit">Draw my chart</button>
			</form>
			<figure className={style.plate}>
				<Wheel birthday={birthday} />
				<figcaption aria-live="polite">
					{birthday ? (
						<>
							<time dateTime={birthday.toString()}>
								✦ {displayDate(birthday)}
							</time>
							<h2>
								{nearest
									.map(({ object }) => object.name)
									.join(' & ')}
							</h2>
							{nearest.map(({ object }) => (
								<p key={object.designator}>{object.reading}</p>
							))}
							<small>
								Closest launch{' '}
								{nearest.length === 1
									? 'anniversary'
									: 'anniversaries'}
							</small>
						</>
					) : (
						<>
							<h2>The launch calendar</h2>
							<p>
								Each symbol marks the day an object launched.
								Your birthday adds a star to the wheel.
							</p>
						</>
					)}
				</figcaption>
			</figure>
			<h2 className={style.sectionTitle}>The objects</h2>
			<ul className={style.catalogue}>
				{objects.map(object => (
					<li key={object.designator}>
						<span className={style.icon}>
							<ObjectGlyph object={object} />
						</span>
						<div>
							<h3>{object.name}</h3>
							<p>{object.description}</p>
							{birthday && (
								<p className={style.relation}>
									{anniversaryLabel(
										daysFromBirthday(
											birthday,
											object.launched
										)
									)}
									{' · '}
									{birthRelation(birthday, object.launched)}
								</p>
							)}
							<small>
								Launched{' '}
								<time dateTime={object.launched.toString()}>
									{displayDate(object.launched)}
								</time>
								{' · '}
								<a href={object.source}>{object.designator}</a>
							</small>
						</div>
					</li>
				))}
			</ul>
		</article>
	);
}

function birthRelation(
	birthday: Temporal.PlainDate,
	launch: Temporal.PlainDate
) {
	const days = launch.until(birthday).days;
	if (days === 0) return 'Launched the day you were born';
	const count = Math.abs(days);
	return `Launched ${count.toLocaleString('en-GB')} ${count === 1 ? 'day' : 'days'} ${days > 0 ? 'before' : 'after'} you were born`;
}

export const metadata: Metadata = {
	title: 'Space junk star chart',
	description:
		'Find your birthday’s closest match among three space-junk launch anniversaries.',
};
export const handle = { metadata };
