import * as Matrix from './matrix'
export type Vector<T extends number = number> = Matrix.Matrix<1, T>
export type Point<T extends number = number> = Vector<T>
export type Point2D = Point<2>
export type Point3D = Point<3>
export type Line2D = Point2D[]
export type Line3D = Point3D[]
export type Vec3D = Point3D
