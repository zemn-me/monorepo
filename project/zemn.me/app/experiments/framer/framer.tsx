'use client';
import { ReactElement, SVGProps, useId, useState } from 'react';
import { z } from 'zod';

import {
	FrameData,
	frameSizes,
} from '#root/project/zemn.me/app/experiments/framer/sizes';

type ViewBox = [minX: number, minY: number, maxX: number, maxY: number];

type ViewBoxableElements = SVGProps<SVGRectElement>;

/**
 * Given a React element of some SVG element, calculate its appropriate viewbox
 */
function viewBox({ props }: ReactElement<ViewBoxableElements>): ViewBox {
	if (
		typeof props.width === 'number' &&
		typeof props.height === 'number' &&
		typeof props.x === 'number' &&
		typeof props.y === 'number'
	) {
		return [props.x, props.y, props.width, props.height];
	}
}

function FrameRender(props: FrameData) {
	const [h, w] = [props.height.value, props.width.value];
	return (
		<svg height={h} viewBox={`0 0 ${w} ${h}`} width={w}>
			<g transform={`translate(${w / 2} ${h / 2})`}>
				<rect
					fill="black"
					height="100%"
					opacity="0.2"
					width="100%"
					x={0}
					y={0}
				/>
			</g>

			<text color="red" textAnchor="middle" x="50%" y="0%">
				{props.name}
			</text>
		</svg>
	);
}

export function Framer() {
	const [widthInput, setWidthInput] = useState<string>('10');
	const widthInputId = useId();
	const [heightInput, setHeightInput] = useState<string>('10');
	const heightInputId = useId();

	const [width, height] = [widthInput, heightInput].map(s =>
		z.number().safe().safeParse(parseInt(s))
	);

	const sizeData = !width?.success
		? width
		: !height?.success
			? height
			: ({
					success: true,
					frameSizes: frameSizes
						.map(candidate => {
							const freeSpace = {
								width: candidate.width.value,
								height: candidate.height.value - height.data,
							};

							// too small.
							if (
								[freeSpace.width, freeSpace.height].some(
									v => v < 0
								)
							)
								return undefined;

							const aggregateFreeSpace =
								freeSpace.width + freeSpace.height;

							return {
								...candidate,
								freeSpace: aggregateFreeSpace,
							};
						})
						.sort(
							(a, b) =>
								(a?.freeSpace ?? -Infinity) -
								(b?.freeSpace ?? -Infinity)
						),
				} as const);

	return (
		<form>
			width
			<input
				id={widthInputId}
				onChange={e => setWidthInput(e.target.value)}
				type="number"
				value={widthInput}
			/>
			height
			<input
				id={heightInputId}
				onChange={e => setHeightInput(e.target.value)}
				type="number"
				value={heightInput}
			/>
			<output htmlFor={[widthInputId, heightInputId].join(' ')}>
				{sizeData === undefined ? null : sizeData.success == false ? (
					<>Error: {sizeData.error.toString()}</>
				) : (
					<svg
						style={{ backgroundColor: 'white' }}
						viewBox="0 0 100 100"
					>
						<svg>
							<g transform={`translate(50 50)`}>
								{sizeData.frameSizes.map(frame =>
									frame === undefined ? null : (
										<FrameRender
											key={frame.name}
											{...frame}
										/>
									)
								)}
								{width?.success && height?.success ? (
									<rect
										cx={0}
										cy={0}
										fill="white"
										rx={width.data / 2}
										ry={height.data / 2}
									/>
								) : null}
							</g>
						</svg>
					</svg>
				)}
			</output>
		</form>
	);
}
