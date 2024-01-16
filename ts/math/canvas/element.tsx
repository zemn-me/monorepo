import React from 'react';
import * as Homog from 'ts/math/homog';

import * as Cnv from '.';

export interface CanvasProps {
	readonly draw: Cnv.Drawable2D;
}

export const Canvas: React.FC<CanvasProps> = ({ draw }) => {
	const lines = [
		...(function* (a) {
			for (let i = 0; i < a.length; i++) yield Homog.lineToCart(a[i]!);
		})(draw.lines2D()),
	];

	const xs = [
		...(function* () {
			for (const line of lines) {
				for (const point of line) {
					yield point[0]![0]!;
				}
			}
		})(),
	];

	const ys = [
		...(function* () {
			for (const line of lines) {
				for (const point of line) {
					yield point[1]![0]!;
				}
			}
		})(),
	];

	const [xMax, yMax] = [Math.max(...xs), Math.max(...ys)];
	const [xMin, yMin] = [Math.min(...xs), Math.min(...ys)];

	const [minX, minY] = [xMin, yMin];
	const [width, height] = [Math.abs(xMax - xMin), Math.abs(yMax - yMin)];

	return (
		<svg
			style={{ width: '50vw', height: '50vh' }}
			viewBox={`${minX} ${minY} ${width} ${height}`}
		>
			{[...lines].map(line => {
				const d = line
					.map(([pts], i) => {
						const [x, y] = pts!;
						const cmd = i > 0 ? 'L' : 'M';
						return `${cmd}${x},${y}`;
					})
					.join('');

				return (
					<path
						d={d}
						key={d}
						style={{ fill: 'none', stroke: 'black' }}
						vectorEffect="non-scaling-stroke"
					/>
				);
			})}
		</svg>
	);
};
