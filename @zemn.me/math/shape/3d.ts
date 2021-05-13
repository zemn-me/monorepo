import * as Homog from '../homog'
import * as Matrix from '../matrix'
import * as Canvas from '../canvas'

class Square implements Canvas.Drawable2D {
	public readonly r: number
	public readonly d: number
	get width() {
		return this.d
	}
	constructor(width: number) {
		this.d = width
		this.r = this.d / 2
	}
	public TL(): Homog.Point2D {
		return [[-this.r], [this.r], [1]] as const
	}
	public TR(): Homog.Point2D {
		return [[this.r], [this.r], [1]] as const
	}
	public BL(): Homog.Point2D {
		return [[-this.r], [-this.r], [1]] as const
	}
	public BR(): Homog.Point2D {
		return [[this.r], [-this.r], [1]] as const
	}
	public lines2D() {
		const ret: Homog.Line2D = [
			this.TL(),
			this.TR(),
			this.BR(),
			this.BL(),
			this.TL(),
		]
		return [ret]
	}
}

class As3D<T extends Canvas.Drawable2D> implements Canvas.Drawable3D {
	constructor(public readonly target: T) {}
	public lines3D(): Homog.Line3D[] {
		return this.target.lines2D().map((line) =>
			line.map(
				(point: Homog.Point2D): Homog.Point3D => {
					const [[x], [y], [scale]] = point
					return [[x], [y], [0], [scale]] as const
				},
			),
		)
	}
}

class Translate3D<T extends Canvas.Drawable3D> implements Canvas.Drawable3D {
	constructor(public readonly target: T, public readonly by: Homog.Point3D) {}

	public lines3D(): Homog.Line3D[] {
		return this.target
			.lines3D()
			.map((line) => line.map((point) => Matrix.add(point, this.by)))
	}
}

class Cube implements Canvas.Drawable3D {
	private readonly square: Square
	constructor(public readonly diameter: number) {
		this.square = new Square(diameter)
	}

	lines3D() {
		const A = new Translate3D(new As3D(this.square), [
			[0],
			[0],
			[-this.diameter],
			[1],
		] as const)
		const B = new Translate3D(new As3D(this.square), [
			[0],
			[0],
			[this.diameter],
			[1],
		] as const)
		const [[ATL, ATR, ABR, ABL]] = A.lines3D()
		const [[BTL, BTR, BBR, BBL]] = B.lines3D()

		return [
			...A.lines3D(),
			...B.lines3D(),
			[ATL, BTL],
			[ATR, BTR],
			[ABR, BBR],
			[ABL, BBL],
		]
	}
}
