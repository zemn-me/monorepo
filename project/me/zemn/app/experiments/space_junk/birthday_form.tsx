import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useLocale } from '#root/ts/react/lang/useLocale.js';

import style from './style.module.css';

const fields = {
	year: { label: 'Year', placeholder: 'YYYY', max: 9999 },
	month: { label: 'Month', placeholder: 'MM', max: 12 },
	day: { label: 'Day', placeholder: 'DD', max: 31 },
};
type Field = keyof typeof fields;

export function BirthdayForm({
	asOf,
	showExample,
	onDraw,
}: {
	asOf?: string;
	showExample: boolean;
	onDraw: (date: Temporal.PlainDate) => void;
}) {
	const languages = useLocale();
	const order = useMemo(
		() =>
			new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				year: 'numeric',
				month: 'numeric',
				day: 'numeric',
				timeZone: 'UTC',
			})
				.formatToParts(0)
				.map(part => part.type)
				.filter(
					(name): name is Field =>
						name === 'year' || name === 'month' || name === 'day'
				),
		[languages]
	);
	const [parts, setParts] = useState({ year: '', month: '', day: '' });
	const [error, setError] = useState('');
	function setDate(iso: string) {
		setParts({
			year: iso.slice(0, 4),
			month: iso.slice(5, 7),
			day: iso.slice(8, 10),
		});
		setError('');
	}
	let date: Temporal.PlainDate | undefined;
	if (parts.year && parts.month && parts.day) {
		try {
			date = Temporal.PlainDate.from(
				{
					year: Number(parts.year),
					month: Number(parts.month),
					day: Number(parts.day),
				},
				{ overflow: 'reject' }
			);
		} catch {
			// Keep partial and impossible dates editable until the visitor submits.
		}
	}
	return (
		<form
			className={style.form}
			onSubmit={e => {
				e.preventDefault();
				if (!date) return setError('Enter a valid calendar date.');
				if (asOf && date.toString() > asOf)
					return setError(`Choose a birthday on or before ${asOf}.`);
				setError('');
				onDraw(date);
			}}
		>
			<fieldset className={style.birthday}>
				<legend>Your birthday</legend>
				<div className={style.dateFields}>
					{order.map(name => (
						<label key={name}>
							<input
								aria-label={fields[name].label}
								placeholder={fields[name].placeholder}
								type="number"
								inputMode="numeric"
								required
								name={name}
								autoComplete={`bday-${name}`}
								min={1}
								max={fields[name].max}
								value={parts[name]}
								onChange={e => {
									setParts({
										...parts,
										[name]: e.target.value,
									});
									setError('');
								}}
							/>
						</label>
					))}
					<label
						className={style.calendar}
						title="Choose birthday from calendar"
					>
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							aria-hidden="true"
						>
							<rect x="4" y="5" width="16" height="15" rx="2" />
							<path d="M8 3v5m8-5v5M4 10h16" />
						</svg>
						<input
							type="date"
							aria-label="Choose birthday from calendar"
							min="0001-01-01"
							max={asOf ?? '9999-12-31'}
							value={date?.toString() ?? ''}
							onChange={e => setDate(e.target.value)}
						/>
					</label>
				</div>
			</fieldset>
			<button
				type="submit"
				className={style.draw}
				aria-label="Draw my chart"
				title="Draw my chart"
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M5 12h14m-6-6 6 6-6 6" />
				</svg>
			</button>
			{showExample && (
				<button
					type="button"
					className={style.example}
					onClick={() => {
						setDate('2006-08-01');
						onDraw(Temporal.PlainDate.from('2006-08-01'));
					}}
				>
					Try an example
				</button>
			)}
			{error && <p role="alert">{error}</p>}
		</form>
	);
}
