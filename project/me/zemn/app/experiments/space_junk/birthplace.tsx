import { useRef, useState } from 'react';

import style from './style.module.css';
import { type Birthplace, signPosition } from './zodiac.js';

export function ChartSettings({
	place,
	ascendant,
	onPlace,
}: {
	place?: Birthplace;
	ascendant?: number;
	onPlace: (place?: Birthplace) => void;
}) {
	const summary = useRef<HTMLElement>(null);
	const [latitude, setLatitude] = useState(place?.latitude.toString() ?? '');
	const [longitude, setLongitude] = useState(
		place?.longitude.toString() ?? ''
	);
	return (
		<details className={style.disclosure}>
			<summary ref={summary} id="chart-birthplace">
				Birthplace
			</summary>
			<form
				className={style.settings}
				onSubmit={event => {
					event.preventDefault();
					onPlace(
						latitude && longitude
							? {
									latitude: Number(latitude),
									longitude: Number(longitude),
								}
							: undefined
					);
					event.currentTarget.closest('details')!.open = false;
					summary.current?.focus();
				}}
			>
				<label>
					Latitude (°N)
					<input
						type="number"
						name="latitude"
						min="-90"
						max="90"
						step="any"
						value={latitude}
						onChange={e => setLatitude(e.target.value)}
						required={Boolean(longitude)}
					/>
				</label>
				<label>
					Longitude (°E)
					<input
						type="number"
						name="longitude"
						min="-180"
						max="180"
						step="any"
						value={longitude}
						onChange={e => setLongitude(e.target.value)}
						required={Boolean(latitude)}
					/>
				</label>
				<button type="submit">Apply</button>
			</form>
			<p>
				{place
					? ascendant === undefined
						? 'Rising direction undefined at this birthplace.'
						: `Ascendant · ${signPosition(ascendant)}`
					: 'Leave coordinates empty for an Earth-centred chart.'}
			</p>
		</details>
	);
}
