import * as Homog from '#monorepo/ts/math/homog.js';

export type Drawable2D = LineDrawable2D;

export interface LineDrawable2D {
	lines2D(): Homog.Line2D[];
}

export type Drawable3D = LineDrawable3D;

export interface LineDrawable3D {
	lines3D(): Homog.Line3D[];
}

// Comment due to https://github.com/swc-project/swc/issues/7822#issuecomment-1827113023
// if this comment is deleted, SWC will crash.
//
// Alternatively, if SWC doesn't crash with this comment deleted, hooray!
