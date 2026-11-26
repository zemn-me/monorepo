import type { ReactNode } from 'react';
import style from './style.module.css';
import { degrees, signs } from './zodiac.js';

export function PlacementEntry({
	name,
	glyph,
	designator,
	longitude,
	house,
	target,
	onRevisit,
	children,
}: {
	name: string;
	glyph?: string;
	designator?: string;
	longitude: number;
	house?: number;
	target?: string;
	onRevisit?: () => void;
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
							<span className={style.designator}>
								{designator}
							</span>{' '}
						</>
					)}
					{target ? (
						<a
							href={'#' + target}
							onClick={event => {
								if (
									event.currentTarget.hash ===
										window.location.hash &&
									!event.metaKey &&
									!event.ctrlKey &&
									!event.shiftKey &&
									!event.altKey
								)
									onRevisit?.();
							}}
						>
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
