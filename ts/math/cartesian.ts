import {
	map,
	Vector,
	dot as vecDot,
	magnitude as vecMag,
	unit as vecUnit,
} from '#root/ts/math/vec.js';
export type Point<T extends number = number> = Vector<T, [number]>;
export type Point2D = Point<2>;
export type Point3D = Point<3>;
export type Line2D<L extends number = number> = Vector<L, Point2D>;
export type Line3D<L extends number = number> = Vector<L, Point3D>;

export function denormalisePoint2D(p: Point2D): [x1: number, y1: number] {
	return [x(p), y(p)];
}

/**
 * Convert a polyline into a series of line segments.
 */
export function toLineSegments(line: Line2D): Line2D<2>[] {
	const segments: Line2D<2>[] = [];

	for (let i = 0; i < line.length - 1; i++) {
		const segment: Line2D<2> = [line[i]!, line[i + 1]!];
		segments.push(segment);
	}

	return segments;
}

/**
 * Returns a representation of this Line2D not normalised
 * for use with matrix operations.
 */
export function denormaliseLine2D(
	l: Line2D<2>
): [[x1: number, y1: number], [x2: number, y2: number]] {
	return [
		[x1(l), y1(l)],
		[x2(l), y2(l)],
	];
}

export function point<T extends number>(...p: Vector<T, number>): Point<T> {
	return map(p, n => [n] as [number]);
}

export function add<const _I extends number, const J extends number>(
	m1: Point<J>,
	m2: Point<J>
): Point<J> {
	return map(m1, ([value], index) => [value + m2[index]![0]!] as [number]);
}

export function sub<const _I extends number, const J extends number>(
	m1: Point<J>,
	m2: Point<J>
): Point<J> {
	return map(m1, ([value], index) => [value - m2[index]![0]!] as [number]);
}

export function mul<
	const _I1 extends number,
	const J1 extends number,
	const _I2 extends number,
	const _J2 extends number,
>(m1: Point<J1>, m2: Point<1>): Point<J1> {
	return scale(m1, x(m2));
}

export function translate<N extends number>(a: Point<N>, b: Point<N>): Point<N> {
	return add<1, N>(a, b);
}

export function scale<N extends number>(
	value: Point<N>,
	scalar: number
): Point<N> {
	return map(value, ([coordinate]) => [coordinate * scalar] as [number]);
}

/**
 * Return the normal line of a line.
 */
export function normal(l: Line2D<2>): Line2D<2> {
	const dx = x2(l) - x1(l);
	const dy = y2(l) - y1(l);

	return [
		[[-dy], [dx]],
		[[dy], [-dx]],
	];
}

/**
 * Returns the scalar length of a line.
 */
export function length(l: Line2D<2>): number {
	return magnitude(sub<1, 2>(l[1], l[0]));
}

export function magnitude(l: Point): number {
	return vecMag(l.map(([v]) => v));
}

export function centre(l: Line2D<2>): Point2D {
	const xM = (x1(l) + x2(l)) / 2;
	const yM = (y1(l) + y2(l)) / 2;

	return [[xM], [yM]];
}

export function unit<N extends number>(l: Point<N>): Point<N> {
	return map(vecUnit(map(l, ([x]) => x)), x => [x] as [number]);
}

export const normalise = unit;

export function dot<J extends number>(m1: Point<J>, m2: Point<J>): number {
	return vecDot(
		map(m1, ([value]) => value),
		map(m2, ([value]) => value)
	);
}

export function cross(m1: Point3D, m2: Point3D): Point3D {
	const x1 = x(m1);
	const y1 = y(m1);
	const z1 = z(m1);
	const x2 = x(m2);
	const y2 = y(m2);
	const z2 = z(m2);

	return point<3>(
		y1 * z2 - z1 * y2,
		z1 * x2 - x1 * z2,
		x1 * y2 - y1 * x2
	);
}

export function x1(l: Line2D<2>): number {
	return x(l[0]);
}

export function x2(l: Line2D<2>): number {
	return x(l[1]);
}

export function y1(l: Line2D<2>): number {
	return y(l[0]);
}

export function y2(l: Line2D<2>): number {
	return y(l[1]);
}

export function x(p: [...Point<1>, ...unknown[]]): number {
	return p[0]![0]!;
}

export function y(p: [...Point<2>, ...unknown[]]): number {
	return p[1]![0]!;
}

export function z(p: [...Point<3>, ...unknown[]]): number {
	return p[2]![0]!;
}

/**
 * For a hyperrectangle of N dimensions defined by a minimum
 * and maximum point, returns if a point would exist inside that
 * rectangle.
 */
export const rectContaninsPoint =
	<const N extends number>(min: Point<N>) =>
	(max: Point<N>) =>
	(point: Point<N>): boolean =>
		point.every((col, ci) =>
			col.every(
				(scalar, ri) => scalar > min[ci]![ri]! && scalar < max[ci]![ri]!
			)
		);

/**
 * Given a point in form [x,y], return
 * in the matrix from [[x], [y]].
 */
export function cartesianCanonicalise<L extends number>(
	v: Vector<L>
): Point<L> {
	return map(v, n => [n] as [number]);
}
