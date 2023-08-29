import * as Homog from 'monorepo/ts/math/homog.js';

export type Drawable2D = LineDrawable2D;

export interface LineDrawable2D {
	lines2D(): Homog.Line2D[];
}

export type Drawable3D = LineDrawable3D;

export interface LineDrawable3D {
	lines3D(): Homog.Line3D[];
}
