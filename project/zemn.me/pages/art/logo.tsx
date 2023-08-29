import ZemnmezLogo from 'monorepo/project/zemn.me/elements/ZemnmezLogo/index.js';
import React from 'react';

const rect = (
	[x, y]: [number, number],
	width: number,
	height: number
): [number, number][] => [
	[x, y],
	[x + width, y],
	[x + width, y + height],
	[x, y + height],
	[x, y],
];

const square = (start: [number, number], r: number) => rect(start, r, r);

const toSegments = (polys: [number, number][][]) => {
	const segments: (string | number)[] = [];

	for (let poly of polys) {
		segments.push('M');
		const firstPoint = poly[0];
		const lastPoint = poly.slice(-1)[0];

		const closed = firstPoint.every((n, i) => n === lastPoint[i]);

		if (closed) {
			poly = poly.slice(0, -1);
		}

		for (const point of poly) {
			segments.push(...point);
		}

		if (closed) {
			segments.push('z');
		}
	}

	return segments;
};

const segmentsToPath = (segments: (string | number)[]) =>
	segments
		.map(s => s.toString().replace(/0./, '.'))
		.reduce((p, c) =>
			// if acc ends with a number, and
			// current begins with a number, add a comma
			/\d$/g.test(p) && /^\d/.test(c) ? p + ',' + c : p + c
		);

const SVGPath = (polys: [number, number][][]) =>
	segmentsToPath(toSegments(polys));
export interface Config {
	smallSquare: number;
	bigSquare: number;
	gap: number;
}

export const size: (c: Config) => [number, number] = ({
	smallSquare: s,
	bigSquare: b,
	gap: g,
}) => [s + g + b + g + s, s + g + b + g + s];

export const Element: React.FC = () => {
	const bigSq = 4;
	const smallSq = 1;
	const gap = smallSq;
	const [maxX, maxY] = size({
		smallSquare: smallSq,
		bigSquare: bigSq,
		gap: gap,
	});
	const r = 0.1;
	const growX = maxX * r;
	const growY = maxY * r;
	return (
		<>
			<p>
				yeah, so basically if you're seeing this, this is a simple way
				to generate the zemnmez logo, but (1) svg viewbox calculations
				are hard, and (2) there isnt a sane way to scale about center,
				so this *does* generate the logo, but only in the sense I do
				this and then hand edit it a bit.
			</p>
			<svg viewBox={`${-growX} ${-growY} ${maxX} ${maxY}`}>
				<path
					d={SVGPath([
						// top left small sq
						square([0, 0], 1),

						rect([0 + smallSq + gap, 0], bigSq, smallSq),

						square([smallSq + gap, smallSq + gap], bigSq),

						rect(
							[
								0 + smallSq + gap,
								0 + bigSq + gap + smallSq + gap,
							],
							bigSq,
							smallSq
						),

						square(
							[
								0 + smallSq + gap + bigSq + gap,
								0 + bigSq + gap + smallSq + gap,
							],
							smallSq
						),

						rect(
							[
								0 + smallSq + gap + bigSq + gap,
								0 + gap + smallSq,
							],
							smallSq,
							bigSq
						),

						rect([0, 0 + gap + smallSq], smallSq, bigSq),
					])}
					fill="black"
					transform={`rotate(-45 ${maxX / 2} ${maxY / 2})`}
				/>
			</svg>
			<p>Here's the one I hand edited after generation:</p>
			<ZemnmezLogo />
		</>
	);
};

export default Element;
