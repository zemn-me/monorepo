import * as Homog from '../homog';
import * as Canvas from '../canvas';

class Square implements Canvas.Drawable2D {
    public readonly r: number;
    public readonly d: number;
    get width() { return this.d }
    constructor(width: number) {
        this.d = width;
        this.r = this.d/2;
    }
    public TL(): Homog.Point2D {
        return [[ - this.r], [this.r], [1]] as const
    }
    public TR(): Homog.Point2D {
        return [ [this.r], [this.r], [1]] as const
    }
    public BL(): Homog.Point2D {
        return [ [-this.r], [-this.r], [1]] as const
    }
    public BR(): Homog.Point2D {
        return [ [this.r], [-this.r], [1]] as const
    }
    public lines2D(): Homog.Line2D[] {
        const ret: Homog.Line2D = [ this.TL(), this.TR(), this.BR(), this.BL(), this.TL() ];
        return [ret]
    }
}

class As3D<T extends Canvas.Drawable2D> implements Canvas.Drawable3D {
    constructor(public readonly target: T) {}
    public lines3D(): Homog.Line3D[] {
        return this.target.lines2D().map(line => 
            line.map((point: Homog.Point2D): Homog.Point3D => {
                const [ [x], [y], [scale] ] = point; 
                return [ [x], [y], [0], [scale] ] as const
            })
        )
    }
}

class Translate2D<T extends Canvas.Drawable2D> implements Canvas.Drawable2D {
    constructor(public target: T) {}
}


class Cube implements Canvas.Drawable3D {
    constructor(public readonly diameter: number){}

    lines() {
        return [

        ]
    }
}