'use client';
import { ChangeEvent, SVGProps, useCallback, useId, useState } from 'react';
import { match } from 'ts-pattern';

import { frameSizes } from '#root/project/zemn.me/app/experiments/framer/sizes';
import { map } from '#root/ts/iter';

/**
 * This is NOT an svg viewbox. for some reason, they use width and height
 * like an actual rectangle lmao.
 */
type ViewBox = [minX: number, minY: number, maxX: number, maxY: number];

const svgViewBox = ([minX, minY, maxX, maxY]: ViewBox) => [
	minX,
	minY,
	Math.abs(minX - maxX),
	Math.abs(minY - maxY),
];

interface RectLike {
	cx: number;
	cy: number;
	width: number;
	height: number;
	fill?: string;
	stroke?: string;
	key: string;
}

interface Rect extends RectLike {
	type: 'rect';
	caption?: string
}

interface Text extends RectLike {
	type: 'text';
	text?: string;
	orientation: 'bottom' | 'left' | 'centre' | 'top' | 'right';
}

type Element = Rect | Text;

interface RenderElementsProps {
	readonly elements: Element[];
}

function rectViewBox({
	x,
	y,
	width,
	height,
	strokeWidth = 0,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
	strokeWidth?: number;
}): ViewBox {
	// it might seem weird that we both add and subtract strokeWidth,
	// but this just reflects that the stroke extends from either side of the
	// line, and cannot exit the viewbox.
	const X = [x, width + x + strokeWidth, width + x - strokeWidth];
	const Y = [y, height + y + strokeWidth, width + y - strokeWidth];
	return [Math.min(...X), Math.min(...Y), Math.max(...X), Math.max(...Y)];
}

function annotatedRect({ type: _, key, ...props }: Rect): Element[] {
	return [
		{ type: 'rect', ...props, key: key + '-rect' },
		{
			type: 'text',
			text: `${props.height.toFixed(0)}cm`,
			orientation: 'left',
			...props,
			key: key + '-height',
		},
		{
			type: 'text',
			text: `${props.width.toFixed(0)}cm`,
			orientation: 'bottom',
			...props,
			key: key + '-width',
		},
		{
			type: 'text',
			text: props.caption,
			orientation: 'right',
			...props,
			key: key + '-right',
		},
	];
}

/**
 * for an element that has a center of cx or cy, and a width of height of size,
 * returns an x or y that corresponds to a top-left origin for the rectangle.
 */
const centreAxis = (centrePoint: number, size: number) =>
	centrePoint - size / 2;

function RenderElements({ elements }: RenderElementsProps) {
	const x = elements.map(element =>
		match(element)
			.with({ type: 'rect' }, e => {
				const [x, y] = (
					[
						[e.cx, e.width],
						[e.cy, e.height],
					] as const
				).map(([a, b]) => centreAxis(a, b)) as [number, number];

				const { width, height, key } = e;
				const strokeWidth = 1;

				const style = {
					fill: e.fill,
					stroke: e.stroke,
					strokeWidth,
				};

				const props = { style, x, y, width, height, key, strokeWidth };

				return [
					rectViewBox(props),
					<rect vectorEffect="non-scaling-stroke" {...props} key={e.key + 'rect'} />,
				] as const;
			})
			.with({ type: 'text' }, e => {
				const [x, y] = (
					[
						[e.cx, e.width],
						[e.cy, e.height],
					] as const
				).map(([a, b]) => centreAxis(a, b)) as [number, number];

				const { width, height, key } = e;
				const props: SVGProps<SVGForeignObjectElement> = {
					x,
					y,
					width,
					height,
					key,
				};

				const style = {
					width: '100%',
					textAlign: 'center',
					height: '100%',
					fontSize: '10%',
					writingMode: match(e.orientation)
						.with(
							'bottom',
							'centre',
							'top',
							() => 'horizontal-tb' as const
						)
						.with('left', () => 'vertical-lr' as const)
						.with('right', () => 'vertical-rl' as const)
						.exhaustive(),
					verticalAlign: match(e.orientation)
						.with('bottom', 'left', 'right', () => 'bottom')
						.with('top', () => 'top')
						.with('centre', () => 'middle')
						.exhaustive(),
				} as const;

				return [
					rectViewBox({
						width: width!,
						height: height!,
						x: x!,
						y: y!,
					}),
					<foreignObject {...props} key={props.key + 'foreignObject'}>
						<div style={style}>{e.text}</div>
					</foreignObject>,
				] as const;
			})
			.exhaustive()
	);

	return (
		<svg viewBox={svgViewBox(flattenViewBox(map(x, x => x[0]))).join(' ')}>
			{[...map(x, x => x[1])]}
		</svg>
	);
}

function flattenViewBox(i: Iterable<ViewBox>): ViewBox {
	let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [mx, my, max, may] of i) {
		if (mx < minX) minX = mx;
		if (my < minY) minY = my;
		if (max > maxX) maxX = max;
		if (may > maxY) maxY = may;
	}

	return [minX, minY, maxX, maxY];
}



export function Framer() {
	const inputWidthElementId = useId();
	const inputHeightElementId = useId();

	const [widthInput, setWidthInput] = useState<string>("");
	const onWidthInput = useCallback((e: ChangeEvent<HTMLInputElement>) =>
			setWidthInput(e.target.value),
	[ setWidthInput] );
	const [heightInput, setHeightInput] = useState<string>("");
	const onHeightInput = useCallback((e: ChangeEvent<HTMLInputElement>) =>
			setHeightInput(e.target.value),
	[ setHeightInput] );

	const width = parseInt(widthInput);
	const height = parseInt(heightInput);


	const candidates = frameSizes.map(v => ({
		matteSpaceX: v.width.value - width,
		matteSpaceY: v.height.value - height,
		...v
	})).sort((a, b) => {
		const freeSpaceA = a.matteSpaceX + a.matteSpaceY;
		const freeSpaceB = b.matteSpaceX + b.matteSpaceY;
		return freeSpaceA - freeSpaceB;
	});

	const topCandidates = candidates.slice(0, 3);

	const toRender = [
		...topCandidates,
		{
			width: { value: width }, height: { value: height }, name: "candidate frame"
		}
	];



	const inputIds = [inputWidthElementId, inputHeightElementId];
	return (
		<>
		<form>

				I want to frame an item of size:
				<input type="number" id={widthInput} onChange={onWidthInput} value={widthInput} />cm x
				<input type="number" id={heightInput} onChange={onHeightInput} value={heightInput} />cm

				<output htmlFor={inputIds.join(" ")}>

			<RenderElements
				elements={toRender
					.map(v =>
						annotatedRect({
							...v,
							width: v.width.value,
							height: v.height.value,
							cx: 0,
							cy: 0,
							type: 'rect',
							key: v.name,
							stroke: 'var(--foreground-color, white)',
							caption: v.name
						})
					)
					.flat(1)}
			/>
		</output>
		</form>

		</>

	);
}
