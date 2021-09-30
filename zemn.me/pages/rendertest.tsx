import { Canvas } from '../@zemn.me/math/canvas/element'
import * as Shape from '../@zemn.me/math/shape'
import React from 'react'

const translateMin = -100000
const translateMax = -translateMin

const iMin = -4
const iMax = -iMin
const iStep = 0.01

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

	const [r, setR] = React.useState<number>(1)
	const [i, setI] = React.useState<number>(0)
	const [j, setJ] = React.useState<number>(0)
	const [k, setK] = React.useState<number>(0)

	const onRChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setR(() => +n)
		},
		[setC],
	)

	const onIChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setI(() => +n)
		},
		[setC],
	)

	const onJChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setJ(() => +n)
		},
		[setC],
	)

	const onKChange = React.useCallback(
		(e: { target: { value: string } }) => {
			const n = e.target.value
			setK(() => +n)
		},
		[setC],
	)

	return (
		<>
			<h1>A Square!</h1>
			<Canvas draw={new Shape.Square(10)} />
			<h1>A Cube!</h1>

			<fieldset>
				<legend>Translate</legend>
				<fieldset>
					<legend>x</legend>
					<input
						id="x"
						type="range"
						min={translateMin}
						max={translateMax}
						value={a}
						onChange={onAChange}
					/>
					<input value={a} onChange={onAChange} />
				</fieldset>

				<fieldset>
					<legend>y</legend>

					<input
						type="range"
						id="y"
						min={translateMin}
						max={translateMax}
						value={b}
						onChange={onBChange}
					/>
					<input value={b} onChange={onBChange} />
				</fieldset>
				<fieldset>
					<legend>z</legend>
					<input
						id="z"
						type="range"
						min={translateMin}
						max={translateMax}
						value={c}
						onChange={onCChange}
					/>
					<input value={c} onChange={onCChange}/>
				</fieldset>
			</fieldset>
			<fieldset>
				<legend>Quaternion Rotation</legend>
				<fieldset>
					<legend>real</legend>

				<input
					id="r"
					type="range"
					min={iMin}
					max={iMax}
					step={iStep}
					value={r}
					onChange={onRChange}
				/>
				<input value={r} onChange={onRChange}/>
				</fieldset>
				<fieldset>
					<legend>i</legend>
					<input
						type="range"
						id="i"
						min={iMin}
						max={iMax}
						value={i}
						onChange={onIChange}
						step={iStep}
					/>
					<input value={i} onChange={onIChange}/>
				</fieldset>
				<fieldset>
					<legend>j</legend>
				<input
					id="j"
					type="range"
					min={iMin}
					max={iMax}
					value={j}
					onChange={onJChange}
					step={iStep}
				/>
				<input value={j} onChange={onJChange}/>
				</fieldset>
				<fieldset>
					<legend>k</legend>
					<input
						id="k"
						type="range"
						min={iMin}
						max={iMax}
						value={k}
						onChange={onKChange}
						step={iStep}
					/>
					<input value={k} onChange={onKChange}/>
				</fieldset>
			</fieldset>
			<Canvas
				draw={
					new Shape.Project(
						new Shape.QuaternionRotate(
							new Shape.Translate3D(new Shape.Cube(10), [
								[a / 1000],
								[b / 1000],
								[c / 1000],
								[1],
							] as const),
							{ pr: r, pi: i, pj: j, pk: k },
						),
					)
				}
			/>
		</>
	)
}
