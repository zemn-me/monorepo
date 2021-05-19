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
	// in units per second
	public wind: Cart.Vec3D = [[0], [0], [-1]] as const
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
	const [a, setA] = React.useState<number>(0)
	const [b, setB] = React.useState<number>(0)
	const [c, setC] = React.useState<number>(0)

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

	const space3d = React.useMemo(() => {
		const r = new Rain()
		r.size = 10
		r.addRainDrops(10)
		return r
	}, [])

	const space2d = new Shape.Project(
		new Shape.Translate3D(space3d, [
			[a / 1000],
			[b / 1000],
			[c / 1000],
			[1],
		] as const),
	)

	return (
		<>
			<h1>A Square!</h1>
			<Canvas draw={new Shape.Square(10)} />
			<h1>A Cube!</h1>
			<input
				type="range"
				min="-100000"
				max="100000"
				value={a}
				onChange={onAChange}
			/>
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
			<Canvas draw={space2d} />
		</>
	)
}
