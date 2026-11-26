import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocale } from '#root/ts/react/lang/useLocale.js';
import type { City } from './cities.js';
import style from './style.module.css';

const cityName = (city: City) =>
	[...new Set([city.name, city.admin1, city.country].filter(Boolean))].join(
		', '
	);

export function CitySearch({
	city,
	onSelect,
}: {
	city?: City;
	onSelect: (city?: City) => void;
}) {
	const id = 'chart-birth-city';
	const languages = useLocale();
	const language = new Intl.Locale(languages[0]).language;
	const [draft, setDraft] = useState<string | null>(null);
	const [term, setTerm] = useState('');
	const [active, setActive] = useState(0);
	const input = draft?.trim() ?? '';
	useEffect(() => {
		const timer = setTimeout(() => setTerm(input), 200);
		return () => clearTimeout(timer);
	}, [input]);
	const ready = input.length >= 2 && input === term;
	const search = useQuery({
		queryKey: ['star-chart-cities', language, term],
		enabled: ready,
		staleTime: 86400000,
		retry: false,
		meta: { persist: false },
		queryFn: async ({ signal }): Promise<City[]> => {
			const response = await fetch(
				'/experiments/space-junk/cities/' +
					encodeURIComponent(term) +
					'?lang=' +
					encodeURIComponent(language),
				{ signal }
			);
			if (!response.ok) throw new Error('City search unavailable');
			return response.json();
		},
	});
	const options = ready ? (search.data ?? []) : [];
	function choose(candidate: City) {
		onSelect(candidate);
		setDraft(null);
	}
	return (
		<div
			className={style.citySearch}
			onBlur={event => {
				if (!event.currentTarget.contains(event.relatedTarget))
					setDraft(null);
			}}
		>
			<label htmlFor={id}>City of birth</label>
			<input
				id={id}
				type="search"
				placeholder="Search cities"
				role="combobox"
				autoComplete="off"
				enterKeyHint="search"
				maxLength={120}
				aria-autocomplete="list"
				aria-controls={id + '-cities'}
				aria-expanded={options.length > 0}
				aria-activedescendant={
					options[active] ? id + '-' + options[active].id : undefined
				}
				value={draft ?? (city ? cityName(city) : '')}
				onChange={event => {
					setDraft(event.target.value);
					setActive(0);
					if (!event.target.value && city) onSelect(undefined);
				}}
				onFocus={event => event.target.select()}
				onKeyDown={event => {
					if (event.key === 'Escape') {
						setDraft(null);
						event.preventDefault();
						return;
					}
					if (!options.length) return;
					if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
						event.preventDefault();
						setActive(
							(active +
								(event.key === 'ArrowDown' ? 1 : -1) +
								options.length) %
								options.length
						);
					} else if (event.key === 'Enter' && options[active]) {
						event.preventDefault();
						choose(options[active]);
					}
				}}
			/>
			<ul
				role="listbox"
				id={id + '-cities'}
				aria-label="Matching cities"
				hidden={!options.length}
			>
				{options.map((option, index) => (
					<li
						key={option.id}
						role="option"
						id={id + '-' + option.id}
						aria-selected={index === active}
						onPointerDown={event => event.preventDefault()}
						onClick={() => choose(option)}
					>
						{cityName(option)}
					</li>
				))}
			</ul>
			{ready && !options.length && (
				<small role="status">
					{search.isError
						? 'City search unavailable.'
						: search.isPaused
							? 'City search is offline.'
							: search.isPending
								? 'Searching…'
								: 'No matching cities.'}{' '}
					{search.isError && (
						<button
							type="button"
							onMouseDown={e => e.preventDefault()}
							onClick={() => void search.refetch()}
						>
							Retry
						</button>
					)}
				</small>
			)}
		</div>
	);
}
