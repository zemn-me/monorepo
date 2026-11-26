import type { ReactNode } from 'react';
import style from './style.module.css';
import { degrees, signs } from './zodiac.js';

export function PlacementEntry({
	name,
	glyph,
	designator,
	longitude,
	house,
	locate,
	children,
}: {
	name: string;
	glyph?: string;
	designator?: string;
	longitude: number;
	house?: number;
	locate?: () => void;
	children?: ReactNode;
}) {
	const value = degrees(longitude);
	const sign = Math.floor(value / 30);
	const seconds = Math.floor((value % 30) * 3600);
	const angle = `${Math.floor(seconds / 3600)}° ${Math.floor(seconds / 60) % 60}′ ${seconds % 60}″`;
	return (
		<li>
			<header>
				<h3>
					{glyph && (
						<span aria-hidden="true">
							{glyph}
							{'\uFE0E'}{' '}
						</span>
					)}
					{designator && (
						<>
							<span className={style.designator}>{designator}</span>{' '}
						</>
					)}
					{locate ? (
						<a href="#star-chart" onClick={locate}>
							{name}
						</a>
					) : (
						name
					)}
				</h3>
				<span>
					{signs[sign]} {angle}
					{house !== undefined && (
						<>
							{' '}
							<span>· House {house}</span>
						</>
					)}
				</span>
			</header>
			{children}
		</li>
	);
}
