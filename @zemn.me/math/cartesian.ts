import * as Matrix from './matrix'
export type Point<T extends number = number> = Matrix.Matrix<1, T>
export type Point2D = Point<2>
export type Point3D = Point<3>
