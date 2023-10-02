import React from 'react';

interface RayProps {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
	readonly transform: string;
	readonly maxSegments: number;
	readonly minSegments: number;
	readonly strokeWidth: number;
	readonly stroke: string;
}

function Ray(props: RayProps) {
	const { maxSegments, minSegments, ...lineProps } = props;
	const nSegments = Math.floor(
		(maxSegments - minSegments) * Math.random() + props.minSegments
	);

	const { sqrt, pow, abs } = Math;
	const { x1, x2, y1, y2 } = props;
	// thanks pythagoras
	const length = sqrt(pow(abs(x1 - x2), 2) + pow(abs(y1 - y2), 2));

	const segmentLengths = [...Array(nSegments)].map(() => Math.random());

	const totalSegmentLengths = segmentLengths.reduce((p, c) => p + c, 0);

	const scaleFactor = length / totalSegmentLengths;

	return (
		<line
			{...lineProps}
			strokeDasharray={segmentLengths.map(v => v * scaleFactor).join(' ')}
		/>
	);
}

interface RaysProps {
	readonly nRays: number;
	readonly transform?: string;
	readonly length: number;
	readonly strokeWidth: number;
	readonly innerSpacePerc: number;
	readonly randomAmountPerc: number;
	readonly maxSegments: number;
	readonly minSegements: number;
}

function Rays(props: RaysProps) {
	const innerSpaceAmount = (props.innerSpacePerc / 100) * props.length;
	const baseRayLength = props.length - innerSpaceAmount;
	const unwaveringLength = baseRayLength * (1 - props.randomAmountPerc / 100);
	return (
		<g transform={props.transform}>
			{[...Array(props.nRays)].map((_, t) => {
				const waveringLength =
					baseRayLength *
					(props.randomAmountPerc / 100) *
					Math.random();
				const rayLength = unwaveringLength + waveringLength;

				return (
					<Ray
						key={`${t}`}
						maxSegments={props.maxSegments}
						minSegments={props.minSegements}
						stroke={`black`}
						strokeWidth={props.strokeWidth}
						transform={`rotate(${(360 / props.nRays) * t} 0 0)`}
						x1={innerSpaceAmount}
						x2={rayLength}
						y1={0}
						y2={0}
					/>
				);
			})}
		</g>
	);
}

function ParseInt(s: string): number | Error {
	const int = +s;
	if (isNaN(int)) return new Error(`${s} is not a valid number.`);
	if (int === Infinity || -int === Infinity)
		return new Error(`cannot be infinity.`);

	return int;
}

interface nVarState {
	input: string;
	error?: Error;
	value: number;
}

function nVar(initialState: number): [nVarState, (s: string) => void] {
	const [state, setState] = React.useState<nVarState>({
		input: '' + initialState,
		value: initialState,
	});

	return [
		state,
		(s: string) => {
			const v = ParseInt(s);
			setState(o => ({
				input: s,
				error: v instanceof Error ? v : undefined,
				value: v instanceof Error ? o.value : v,
			}));
		},
	];
}

export default function RaysEditor() {
	const width = 100;
	const height = width;
	const [nRays, setNRays] = nVar(100);
	const [rayLengthPerc, setRayLengthPerc] = nVar(30);
	const [strokeWidth, setStrokeWidth] = nVar(100);
	const [innerSpacePerc, setInnerSpacePerc] = nVar(10);
	const [randomAmountPerc, setRandomAmountPerc] = nVar(0);
	const [maxSegments, setMaxSegments] = nVar(8);
	const [minSegments, setMinSegments] = nVar(2);

	const labelStyle = { display: 'inline-block' };
	return (
		<div
			style={{
				display: 'grid',
				grid: "'display' 1fr 'kitchen-sink' auto",
				width: '100vw',
				height: '100vh',
			}}
		>
			<svg
				style={{
					gridArea: 'kitchen-sink',
					width: '100%',
					height: '100%',
				}}
				viewBox={`0 0 ${width} ${height}`}
			>
				<Rays
					innerSpacePerc={innerSpacePerc.value}
					length={height * (rayLengthPerc.value / 100)}
					maxSegments={maxSegments.value}
					minSegements={minSegments.value}
					nRays={nRays.value}
					randomAmountPerc={randomAmountPerc.value}
					strokeWidth={strokeWidth.value / 1000}
					transform={`translate(${width / 2} ${height / 2})`}
				/>
				{/* these magic numbers are from TimeEye itself */}
				<g
					transform={`translate(${width / 2 - 17.78 / 2} ${
						height / 2 - 7.81 / 2
					})`}
				>
					<TimeEye />
				</g>
			</svg>

			<form style={{ gridArea: 'display' }}>
				<label htmlFor="nRays" style={labelStyle}>
					Number of rays:{' '}
					<input
						id="nRays"
						max="360"
						min="0"
						onChange={e => setNRays(e.target.value)}
						type="range"
						value={nRays.input}
					/>
				</label>

				<label htmlFor="rayLengthPerc" style={labelStyle}>
					Ray length in %:{' '}
					<input
						id="rayLengthPerc"
						max="100"
						min="0"
						onChange={e => setRayLengthPerc(e.target.value)}
						type="range"
						value={rayLengthPerc.input}
					/>
				</label>

				<label htmlFor="strokeWidth" style={labelStyle}>
					Stroke Width / 1000:{' '}
					<input
						id="strokeWidth"
						max="1000"
						min="0"
						onChange={e => setStrokeWidth(e.target.value)}
						type="range"
						value={strokeWidth.input}
					/>
				</label>
				<label htmlFor="innerSpacePerc" style={labelStyle}>
					Inner space %:{' '}
					<input
						id="innerSpacePerc"
						max="100"
						min="0"
						onChange={e => setInnerSpacePerc(e.target.value)}
						type="range"
						value={innerSpacePerc.input}
					/>
				</label>
				<label htmlFor="randomAmountPerc" style={labelStyle}>
					Length picked randomly in %:{' '}
					<input
						id="randomAmountPerc"
						max="100"
						min="0"
						onChange={e => setRandomAmountPerc(e.target.value)}
						type="range"
						value={randomAmountPerc.input}
					/>
				</label>
				<label htmlFor="maxSegments" style={labelStyle}>
					Maximum number of randomly chosen segments:{' '}
					<input
						id="maxSegments"
						max="50"
						min="0"
						onChange={e => setMaxSegments(e.target.value)}
						type="range"
						value={maxSegments.input}
					/>
				</label>

				<label htmlFor="minSegments" style={labelStyle}>
					Minimum number of randomly chosen segments:{' '}
					<input
						id="minSegments"
						max="100"
						min="0"
						onChange={e => setMinSegments(e.target.value)}
						type="range"
						value={minSegments.input}
					/>
				</label>
			</form>
		</div>
	);
}

function TimeEye() {
	return (
		<g transform="translate(-13.03 -62.53)">
			<path
				d="M16.73 62.66l-3.47 6.02h17.32l-3.47-6.02z"
				data-part="frustum"
				strokeWidth=".26"
				style={{ stroke: 'black', fill: 'white' }}
			/>
			<circle
				cx="21.92"
				cy="65.47"
				data-part="iris"
				fill="none"
				r="1.61"
				strokeWidth=".16"
				style={{ stroke: 'black' }}
			/>
			<ellipse
				cx="21.92"
				cy="65.47"
				data-part="sclera"
				fill="none"
				rx="3.23"
				ry="1.58"
				strokeWidth=".23"
				style={{ stroke: 'black' }}
			/>
			<path
				d="M23.53 68.65a1.61 1.61 0 0 1-3.22 0c0-.9.72-1.2 1.61-1.62.9.42 1.61.73 1.61 1.62z"
				data-part="tear"
				strokeWidth=".16"
				style={{ stroke: 'black', fill: 'white' }}
			/>
			<circle
				cx="21.92"
				cy="65.47"
				data-part="pupil"
				r=".54"
				strokeWidth=".08"
				style={{ stroke: 'black' }}
			/>
		</g>
	);
}
