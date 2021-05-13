import * as Homog from './homog';


export type Drawable2D = LineDrawable2D;

export interface LineDrawable2D {
    lines(): Homog.Line2D[]
}