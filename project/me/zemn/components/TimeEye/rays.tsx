import seedrandom from 'seedrandom';

function memoize<T>(fn: (arg: string) => T): (arg: string) => T {
	const cache = new Map<string, T>();

	return function (arg: string): T {
		if (cache.has(arg)) {
			return cache.get(arg)!;
		}
		const result = fn(arg);
		cache.set(arg, result);
		return result;
	};
}

const random = memoize((seed: string) => seedrandom(seed)());

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
	readonly seed?: string;
}

function Ray({ stroke, seed = '', ...props }: RayProps) {
	const { maxSegments, minSegments, ...lineProps } = props;
	const nSegments = Math.floor(
		(maxSegments - minSegments) * random('number of segments' + seed) +
			props.minSegments
	);

	const { sqrt, pow, abs } = Math;
	const { x1, x2, y1, y2 } = props;
	// thanks pythagoras
	const length = sqrt(pow(abs(x1 - x2), 2) + pow(abs(y1 - y2), 2));

	const segmentLengths = [...Array(nSegments)].map((_, n) =>
		random(`segment length ${n}` + seed)
	);

	const totalSegmentLengths = segmentLengths.reduce((p, c) => p + c, 0);

	const scaleFactor = length / totalSegmentLengths;

	return (
		<line
			style={{ stroke }}
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
	readonly innerSpaceVariationPerc?: number;
	readonly randomAmountPerc: number;
	readonly maxSegments: number;
	readonly minSegements: number;
}

export function Rays(props: RaysProps) {
	const innerSpaceAmount = (props.innerSpacePerc / 100) * props.length;
	const baseRayLength = props.length - innerSpaceAmount;
	const unwaveringLength = baseRayLength * (1 - props.randomAmountPerc / 100);
	return (
		<g transform={props.transform}>
			{[...Array(props.nRays)].map((_, t) => {
				const waveringLength =
					baseRayLength *
					(props.randomAmountPerc / 100) *
					random(`wavering length ${t}`);
				const rayLength = unwaveringLength + waveringLength;

				return (
					<Ray
						key={`${t}`}
						maxSegments={props.maxSegments}
						minSegments={props.minSegements}
						seed={t.toString()}
						stroke={`var(--foreground-color)`}
						strokeWidth={props.strokeWidth}
						transform={`rotate(${(360 / props.nRays) * t} 0 0)`}
						x1={
							innerSpaceAmount *
							(1 +
								((props.innerSpaceVariationPerc ?? 0) / 100) *
									random(`inner space ${t}`))
						}
						x2={rayLength}
						y1={0}
						y2={0}
					/>
				);
			})}
		</g>
	);
}
