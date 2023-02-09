import * as Camera from 'ts/math/camera';
import * as Canvas from 'ts/math/canvas';
import * as Homog from 'ts/math/homog';
import * as Matrix from 'ts/math/matrix';
import * as Quaternion from 'ts/math/quaternion';

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
				const [[x], [y], [scale]] = point;
				return [[x], [y], [0], [scale]] as const;
			})
		);
	}
}

export class Translate3D<T extends Canvas.Drawable3D>
	implements Canvas.Drawable3D
{
	constructor(public readonly target: T, public readonly by: Homog.Point3D) {}

	public lines3D(): Homog.Line3D[] {
		return this.target
			.lines3D()
			.map(line => line.map(point => Matrix.add(point, this.by)));
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
		const [[ATL, ATR, ABR, ABL]] = A.lines3D();
		const [[BTL, BTR, BBR, BBL]] = B.lines3D();

		return [
			...A.lines3D(),
			...B.lines3D(),
			[ATL, BTL],
			[ATR, BTR],
			[ABR, BBR],
			[ABL, BBL],
		];
	}
}

export class Project<T extends Canvas.Drawable3D> implements Canvas.Drawable2D {
	constructor(
		public readonly value: T,
		public readonly focalLength?: number
	) {}

	lines2D(): Homog.Line2D[] {
		return this.value
			.lines3D()
			.map(line =>
				line.map(point => Camera.transform(point, this.focalLength))
			);
	}
}

export class QuaternionMultiply<
	T extends Canvas.Drawable3D,
	Q extends Quaternion.Quaternion
> implements Canvas.Drawable3D
{
	constructor(public readonly value: T, public readonly quaternion: Q) {}
	lines3D() {
		return this.value.lines3D().map(line =>
			line.map(point => {
				const [[x], [y], [z]] = Homog.pointToCart(point);
				const q1: Quaternion.Quaternion = [x, y, z, 0];
				const q2 = this.quaternion;
				const n = Quaternion.mul(q1, q2);

				const [nx = 0, ny = 0, nz = 0] = n;
				return [[nx], [ny], [nz], [1]] as const;
			})
		);
	}
}

export class QuaternionRotate<
	T extends Canvas.Drawable3D,
	Q extends Homog.Point3D
> implements Canvas.LineDrawable3D
{
	constructor(public readonly value: T, public readonly rotation: Q) {}
	lines3D() {
		return this.value.lines3D().map(line =>
			line.map(point => {
				const [[x], [y], [z]] = Homog.pointToCart(point);
				const q1: Quaternion.Quaternion = [x, y, z, 0];
				const q2 = this.rotation;
				const n = Quaternion.rotate(Homog.pointToCart(q2), q1);

				const [nx = 0, ny = 0, nz = 0] = n;
				return [[nx], [ny], [nz], [1]] as const;
			})
		);
	}
}
