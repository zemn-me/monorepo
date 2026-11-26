import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
	type City,
	cityShard,
	findCities,
	foldCityName,
	nameShard,
} from './cities.js';
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
	const [draft, setDraft] = useState<string | null>(null);
	const [active, setActive] = useState(0);
	const term = foldCityName(draft ?? '');
	const shard = nameShard(term);
	const ready = shard !== null;
	const search = useQuery(cityShard(shard));
	const options = useMemo(
		() => (ready && search.data ? findCities(search.data, term) : []),
		[ready, search.data, term]
	);
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
