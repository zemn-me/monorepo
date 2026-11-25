import style from './style.module.css';
import type { Birthplace } from './zodiac.js';
import { signPosition } from './zodiac.js';

export function BirthplaceForm({
	place,
	onPlace,
	wheel,
	ascendant,
}: {
	place?: Birthplace;
	onPlace: (p?: Birthplace) => void;
	wheel: boolean;
	ascendant?: number;
}) {
	return (
		<div className={style.origin}>
			{place ? (
				<p>
					Birthplace · {place.latitude}°, {place.longitude}°
				</p>
			) : (
				wheel && <p>Earth-centred · 0° Aries at left</p>
			)}
			{place && wheel && (
				<small>
					{ascendant === undefined
						? 'Rising direction is undefined here. The wheel starts at 0° Aries.'
						: `Ascendant · ${signPosition(ascendant)}`}
				</small>
			)}
			<details>
				<summary id="chart-birthplace">
					{place ? 'Edit birthplace' : 'Set birthplace'}
				</summary>
				<form
					className={style.instant}
					onSubmit={e => {
						e.preventDefault();
						const data = new FormData(e.currentTarget);
						onPlace({
							latitude: Number(data.get('latitude')),
							longitude: Number(data.get('longitude')),
						});
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
							defaultValue={place?.latitude}
							required
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
							defaultValue={place?.longitude}
							required
						/>
					</label>
					<button type="submit">Use birthplace</button>
					{place && (
						<button
							type="button"
							onClick={() => onPlace(undefined)}
						>
							Use Earth’s centre
						</button>
					)}
				</form>
				<small>
					Use negative numbers for south and west. Your birthplace
					sets the sightlines and rising sign.
				</small>
			</details>
		</div>
	);
}
