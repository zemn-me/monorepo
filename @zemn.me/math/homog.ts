import * as Matrix from './matrix'
import * as Cart from './cartesian'

type Extends<T1, T2> = T2 extends T1 ? T2 : never

export type Point2D = Matrix.Matrix<1, 3>
export type Point3D = Matrix.Matrix<1, 4>
export type Vec3D = Point3D
export type Vec2D = Point2D
export type Line2D = readonly Point2D[]
export type Line3D = readonly Point3D[]

export function pointToCart(p: Point2D): Cart.Point2D
export function pointToCart(p: Point3D): Cart.Point3D

export function pointToCart(p: Point3D | Point2D): Cart.Point2D | Cart.Point3D {
	const a = p.map(([v]) => v)
	const scale = a.pop()!
	return a.map((n) => [n * scale]) as any
}

export function lineToCart(p: Line2D): Cart.Line2D
export function lineToCart(p: Line3D): Cart.Line3D

export function lineToCart(line: Line2D | Line3D): Cart.Line2D | Cart.Line3D {
	return line.map((point: any) => pointToCart(point))
}

export function fromCart(p: Cart.Point2D): Point2D
export function fromCart(p: Cart.Point3D): Point3D

export function fromCart(p: Cart.Point2D | Cart.Point3D): any {
    return [...p, [1]]
}
