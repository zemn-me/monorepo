import * as Matrix from '#root/ts/math/matrix.js';
export type Point<T extends number = number> = Matrix.Matrix<1, T>;
export type Point2D = Point<2>;
export type Point3D = Point<3>;
export type Line2D = Point2D[];
export type Line3D = Point3D[];

// Comment due to https://github.com/swc-project/swc/issues/7822#issuecomment-1827113023
// if this comment is deleted, SWC will crash.
//
// Alternatively, if SWC doesn't crash with this comment deleted, hooray!
