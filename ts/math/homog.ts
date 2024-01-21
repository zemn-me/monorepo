import * as Cart from './cartesian';
import * as Matrix from './matrix';

export type Point2D = Matrix.Matrix<1, 3>;
export type Point3D = Matrix.Matrix<1, 4>;
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
