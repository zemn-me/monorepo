import * as Cart from '#root/ts/math/cartesian.js';
import * as Matrix from '#root/ts/math/matrix.js';
import { Add } from '#root/ts/time/typeadd.js';

/**
 * Returns the type of an N-dimensional
 * homogenous coordinate.
 */
export type Point<N extends number> =
	Matrix.Matrix<1, Add<N, 1>>;

export type Point2D = Point<2>
export type Point3D = Point<3>;
export type Line2D = Point2D[];
export type Line3D = Point3D[];

export function pointToCart(p: Point2D): Cart.Point2D;
export function pointToCart(p: Point3D): Cart.Point3D;

export function pointToCart(p: Point3D | Point2D): Cart.Point2D | Cart.Point3D {
	const a = p.map(([v]) => v);
	const scale = a.pop();
	if (!scale) throw new Error();
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	return a.map(n => [n! * scale]) as any;
}

export function lineToCart(p: Line2D): Cart.Line2D;
export function lineToCart(p: Line3D): Cart.Line3D;

export function lineToCart(line: Line2D | Line3D): Cart.Line2D | Cart.Line3D {
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	return line.map((point: any) => pointToCart(point));
}
