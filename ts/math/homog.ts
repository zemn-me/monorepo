import * as Cart from '#root/ts/math/cartesian.js';
import * as Matrix from '#root/ts/math/matrix.js';
import { Vector } from '#root/ts/math/vec.js';

export type Point2D = Matrix.Matrix<1, 3>;
export type Point3D = Matrix.Matrix<1, 4>;

export type Line2D<L extends number = number> = Vector<L, Point2D>;
export type Line3D<L extends number = number> = Vector<L, Point3D>;


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


export function translate3d(pt: Point3D, x: number, y: number, z: number): Point3D {
	const translationMatrix = Matrix.as([
		[1, 0, 0, x],
		[0, 1, 0, y],
		[0, 0, 1, z],
		[0, 0, 0, 1]
	] as const);


	return Matrix.mul<4, 4, 1, 4>(
		translationMatrix, pt,
	)
}
