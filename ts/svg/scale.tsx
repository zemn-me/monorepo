import * as d3Scale from 'd3-scale';
import React from 'react';

import { isDefined as defined, must } from '#root/ts/guard.js';
import * as matrix from '#root/ts/math/matrix.js';
import * as vec from '#root/ts/math/vec.js';

import * as svg from './index';

export type Num = number | { valueOf(): number };

export const labels: <N extends Num>(
	s: AxisScale<N>,
	...labels: ReadonlyArray<readonly [N, string]>
) => AxisScale<N> = <N extends Num>(
	s: AxisScale<N>,
	...labels: ReadonlyArray<readonly [N, string]>
) => {
	const ret = {
		mappings: new Map(labels),
		domain() {
			return s.domain();
		},
		ticks() {
			return labels.map(([N]) => N);
		},
		tickFormat() {
			return (N: N) => must(defined)(this.mappings.get(N));
		},
	} as const;
	return ret;
};

export interface AxisScale<N extends Num> {
	ticks(count?: number): N[];
	domain(): N[];
	tickFormat(count?: number, specifier?: string): (d: N) => string;
}

export enum DIRECTION {
	/** ticks ascend from the baseline */
	Up,

	/** ticks descend from the baseline */
	Down,
}

export interface TicksProps<N extends Num> {
	scale: AxisScale<N>;
	ticks?: number;
	tickFormat?: string;
	stroke?: string;
	direction?: DIRECTION;
}

export const Ticks: <N extends Num>(
	props: TicksProps<N>
) => React.ReactElement = ({
	scale,
	ticks: nTicks,
	tickFormat,
	stroke = 'black',
	direction = DIRECTION.Down,
}) => {
	const formatter = scale.tickFormat(nTicks, tickFormat);
	const ticks = scale.ticks(nTicks).sort();
	const percScale = d3Scale
		.scaleLinear()
		.domain(scale.domain())
		.range([20, 80]);

	return (
		<>
			<svg.Line
				{...{
					path: [
						[0, 0],
						[0, 100],
					] as const,
					stroke,
				}}
			/>

			{ticks.map(tick => {
				const text = formatter(tick);
				const pos = percScale(tick.valueOf())!;
				const tickLength = 40;
				const tickBottomPos = [pos, tickLength] as const;

				let tickPath: svg.Path<2> = [[pos, 0], tickBottomPos] as const;

				let textMiddlePos: svg.Path<1> = [
					vec.add(
						vec.map(tickBottomPos, v => v.valueOf()),
						[
							0,
							direction == DIRECTION.Down
								? tickLength
								: tickLength / 2,
						] as const
					),
				] as const;

				// if the direction is upward, reverse everything about
				// y = 0% by inverting signs and adding the minimum value
				// on the y axis

				if (direction === DIRECTION.Up) {
					// gets the largest y
					const offset: number = Math.max(
						...tickPath
							.map(([, /*x*/ y]) => y!)
							.concat(textMiddlePos.map(([, /*x*/ y]) => y!))
					);

					// this transform sets all y values to -y, flipping
					// the points in the x axis
					// then shifts such that the largest -y is at zero
					// once we do that, we want to anchor the positions
					// to the bottom instead of the top, so we take every
					// position and subtract it from 100
					// why am i doing this with matricies?
					// I just want to be good at matricies someday...
					const transform: matrix.Matrix<3, 3> = [
						[1, 0, 0],
						[0, -1, 0],
						[0, -offset + 180, 1],
					] as const;

					console.log(
						'paths before transform...',
						tickPath,
						textMiddlePos
					);

					tickPath = svg.homog2Cart(
						matrix.mul(svg.cart2Homog(tickPath), transform)
					);
					textMiddlePos = svg.homog2Cart(
						matrix.mul(svg.cart2Homog(textMiddlePos), transform)
					);
					console.log(
						'paths after transform...',
						tickPath,
						textMiddlePos
					);
				}

				return (
					<React.Fragment key={tick.toString()}>
						<svg.Line
							{...{
								path: tickPath,
								stroke,
							}}
						/>

						<svg.Text pos={textMiddlePos} textAnchor="middle">
							{text}
						</svg.Text>
					</React.Fragment>
				);
			})}
		</>
	);
};
