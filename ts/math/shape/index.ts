import * as Canvas from '#root/ts/math/canvas/index.js';
import * as cartesian from '#root/ts/math/cartesian.js';
import * as Homog from '#root/ts/math/homog.js';
import { map } from '#root/ts/math/vec';

export class Square implements Canvas.Drawable2D {
	public readonly r: number;
	public readonly d: number;
	get width(): number {
		return this.d;
	}
	constructor(width: number) {
		this.d = width;
		this.r = this.d / 2;
	}
	public TL(): Homog.Point2D {
		return [[-this.r], [this.r], [1]] as const;
	}
	public TR(): Homog.Point2D {
		return [[this.r], [this.r], [1]] as const;
	}
	public BL(): Homog.Point2D {
		return [[-this.r], [-this.r], [1]] as const;
	}
	public BR(): Homog.Point2D {
		return [[this.r], [-this.r], [1]] as const;
	}
	public lines2D(): Homog.Line2D[] {
		const ret: Homog.Line2D = [
			this.TL(),
			this.TR(),
			this.BR(),
			this.BL(),
			this.TL(),
		];
		return [ret];
	}
}

class As3D<T extends Canvas.Drawable2D> implements Canvas.Drawable3D {
	constructor(public readonly target: T) {}
	public lines3D(): Homog.Line3D[] {
		return this.target.lines2D().map(line =>
			line.map((point: Homog.Point2D): Homog.Point3D => {
				const [xi, yi, scalei] = point;
				const [[x], [y], [scale]] = [xi!, yi!, scalei!];
				return [[x!], [y!], [0], [scale!]] as const;
			})
		);
	}
}

export class Translate3D<T extends Canvas.Drawable3D>
	implements Canvas.Drawable3D
{
	constructor(
		public readonly target: T,
		public readonly by: Homog.Point3D
	) {}

	public lines3D(): Homog.Line3D[] {
		return map(this.target.lines3D(), line =>
			map(line, point => cartesian.add<1, 4>(point, this.by))
		);
	}
}

export class Cube implements Canvas.Drawable3D {
	private readonly square: Square;
	constructor(public readonly diameter: number) {
		this.square = new Square(diameter);
	}

	lines3D(): Homog.Line3D[] {
		const A = new Translate3D(new As3D(this.square), [
			[0],
			[0],
			[-this.diameter],
			[1],
		] as const);
		const B = new Translate3D(new As3D(this.square), [
			[0],
			[0],
			[this.diameter],
			[1],
		] as const);
		const [row1] = A.lines3D();
		const [ATL, ATR, ABR, ABL] = row1!;
		const [row2] = B.lines3D();
		const [BTL, BTR, BBR, BBL] = row2!;

		return [
			...A.lines3D(),
			...B.lines3D(),
			[ATL!, BTL!],
			[ATR!, BTR!],
			[ABR!, BBR!],
			[ABL!, BBL!],
		];
	}
}
