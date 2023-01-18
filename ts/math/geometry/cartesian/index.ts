/**
 * @fileoverview Basic primitives for cartesian geometry.
 */
import { Tuple, Vector } from 'monorepo/ts/math/primitive';



/**
 * A point in arbitrary dimensional space.
 */
export class Point<A extends number[]> extends Vector<A> {
    constructor(...a: A) {
        super(...a)
    }
}

/**
 * A number of connected line segments, expressed as a series of points.
 */
export class PolyLine<P extends Point<number[]>, A extends P[]> extends Tuple<P, A> { }

/**
 * A series of connected line segments, where the last point is connected to the first point.
 */
export class Polygon<P extends Point<number[]>, A extends [ P, ...P[]]> extends PolyLine<P, [P, ...P[], P]> {
    constructor(...a: A) {
        const first = a.shift()!;
        super(first, ...a, first);
    }
}

export class Point2D extends Point<[number, number]> { }
export class PolyLine2D extends PolyLine<Point2D, Point2D[]> {}
export class Polygon2D extends Polygon<Point2D, [Point2D, ...Point2D[]]> {}

export class Point3D extends Point<[number, number, number]> {}
export class PolyLine3D extends PolyLine<Point3D, Point3D[]> {}
export class Polygon3D extends Polygon<Point3D, [ Point3D, ...Point3D[] ]> {}

export class Circle<P extends Point<number[]>, CX extends number, CY extends number, RX extends number, RY extends number> { }

