import * as Braille from '#root/ts/math/canvas/braille/braille.js';
import { Line2D, Line3D, point, Point2D, toLineSegments, x, y } from '#root/ts/math/cartesian';
import * as Homog from '#root/ts/math/homog';
import { matLineToPoints } from '#root/ts/math/raster.js';
import { project } from '#root/ts/math/space/render/project';

export function plot2D(lines: Line2D[], width: number): string {
	const rasterized = lines.flatMap(line =>
		toLineSegments(line).flatMap(segment => [...matLineToPoints(segment)])
	);

	return Braille.plot2D(
		rasterized,
		x,
		y,
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
	return plot2D(
		lines.map(line =>
			line.map(pt => homog2cart2(project(focalLength, [...pt, [1]])))
		),
		width
	);
}
