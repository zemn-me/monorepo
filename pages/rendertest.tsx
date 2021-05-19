import { Canvas } from '../@zemn.me/math/canvas/element'
import * as Shape from '../@zemn.me/math/shape/3d'
import React from 'react'

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
			<Canvas
				draw={
					new Shape.Project(
						new Shape.Translate3D(new Shape.Cube(10), [
							[a / 1000],
							[b / 1000],
							[c / 1000],
							[1],
						] as const),
					)
				}
			/>
		</>
	)
}
