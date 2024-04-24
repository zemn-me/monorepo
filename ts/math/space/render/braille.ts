import { flatten } from '#root/ts/iter';
import * as Braille from '#root/ts/math/canvas/braille/braille.js';
import { Line2D, Line3D, point, Point2D } from '#root/ts/math/cartesian';
import * as Homog from '#root/ts/math/homog';
import { project } from '#root/ts/math/space/render/project';

export function plot2D(lines: Line2D[], width: number): string {
	return Braille.plot2D(
		flatten<[[number], [number]]>(lines),
		([[x]]) => x,
		([[_], [y]]) => y,
		width
	);
}

const homog2cart2 = ([[x], [y], [mul]]: Homog.Point2D): Point2D =>
	point<2>(x * mul, y * mul);

export function plot3D(
	lines: Line3D[],
	focalLength: number,
	width: number
): string {
	return Braille.plotLines2D(
		lines.map(line =>
			line.map(pt => homog2cart2(project(focalLength, [...pt, [1]])))
		),
		(v) => {
			const [v0, v1] = v;
			const [[[x0], [y0]], [[x1], [y1]]] = [v0!, v1!]
			return [[x0, y0], [x1, y1]]
		},
		width
	);
}
