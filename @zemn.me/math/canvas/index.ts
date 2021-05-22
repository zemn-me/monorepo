import * as Homog from '../homog'

export type Drawable2D = LineDrawable2D

export interface LineDrawable2D {
	lines2D(): readonly Homog.Line2D[]
}

export type Drawable3D = LineDrawable3D

export interface LineDrawable3D {
	lines3D(): readonly Homog.Line3D[]
}
