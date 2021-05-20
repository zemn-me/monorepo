import { Canvas } from '@zemn.me/math/canvas/element'
import { Drawable3D } from '@zemn.me/math/canvas'
import * as Homog from '@zemn.me/math/homog'
import * as Cart from '@zemn.me/math/cartesian'
import * as Shape from '@zemn.me/math/shape'
import * as Vec from '@zemn.me/math/vec'
import * as Matrix from '@zemn.me/math/matrix'
import React from 'react'


class Rain implements Drawable3D {
	private raindrops: Homog.Point3D[] = []
	public size: number = 1
	// in cubes per millisecond
	public wind: Cart.Vec3D = [[0], [0], [-1/5000]] as const
	get windGlobal(): Cart.Vec3D {
		return Matrix.fromVec(Vec.mul(this.size, Matrix.asVec(this.wind)))
	}
	public raindropLength: number = 0.1 // in cubes
	addRainDrop() {
		const { size } = this
		const xMin = -size
		const xMax = size
		const yMin = -size
		const yMax = size

		const x = xMin + (xMax - xMin) * Math.random()
		const y = yMin + (yMax - yMin) * Math.random()
		const z = size

		this.raindrops.push([[x], [y], [z], [1]] as const)
	}

	private simulateRaindrop(ms: number) {
		const windDisplacmentv = Vec.mul(ms, Matrix.asVec(this.windGlobal));
		this.raindrops = this.raindrops.map(rd => {
			const rdv = Matrix.asVec(Homog.pointToCart(rd));
			return Homog.fromCart(Matrix.fromVec(Vec.add(
				rdv,
				windDisplacmentv
			)))
		});
	}

	simulate(ms: number) {
		this.simulateRaindrop(ms);
	}


	addRainDrops(howMany: number) {
		for (let i = howMany; i > 0; i--) this.addRainDrop()
	}

	lines3D(): Homog.Line3D[] {
		return [
			...this.raindrops.map((point) => {
				const top = Homog.pointToCart(point)
				const [[tx], [ty], [tz]] = top
				const [bx, by, bz] = Vec.add(
					Matrix.asVec(top),
					Vec.mul(
						this.size * this.raindropLength,
						Vec.unit(Matrix.asVec(this.wind)),
					),
				)
				return [
					[[tx], [ty], [tz], [1]] as Homog.Vec3D,
					[[bx], [by], [bz], [1]] as Homog.Vec3D,
				] as const
			}),
			...new Shape.Cube(this.size).lines3D(),
		]
	}
}

export default function RenderTest() {
	const [a, setA] = React.useState<number>(3000)
	const [b, setB] = React.useState<number>(-9735)
	const [c, setC] = React.useState<number>(-7965)
	const [rainSim, setRainSim] = React.useState<Rain>(() => {
		console.log("starting rain sim");
		const sim = new Rain();
		sim.addRainDrops(10)
		return sim;
	});


	const onAChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setA(() => +n)
		},
		[setA],
	)

	const onBChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setB(() => +n)
		},
		[setB],
	)

	const onCChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setC(() => +n)
		},
		[setC],
	)


	React.useEffect(() => {
		const int = 1000/60
		const hnd = setInterval(() => {
			rainSim.simulate(int)
			setRainSim(() => rainSim)
		}, int);
		return () => clearInterval(hnd)
	}, [ rainSim, setRainSim, ]);

	const space2d = new Shape.Project(
		new Shape.Translate3D(rainSim, [
			[a / 1000],
			[b / 1000],
			[c / 1000],
			[1],
		] as const),
	)

	return (
		<>
			<h1>A Cube!</h1>
			<input
				type="range"
				min="-100000"
				max="100000"
				value={b}
				onChange={onBChange}
			/>
			<input
				type="range"
				min="-100000"
				max="100000"
				value={c}
				onChange={onCChange}
			/>
			<input
				type="range"
				min="-100000"
				max="100000"
				value={a}
				onChange={onAChange}
			/>
			<Canvas draw={space2d} />
			<h1>A Square!</h1>
			<Canvas draw={new Shape.Square(10)} />

		</>
	)
}
