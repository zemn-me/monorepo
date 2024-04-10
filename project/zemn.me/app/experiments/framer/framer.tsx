'use client';
import { ReactElement, SVGProps, useId, useState } from 'react';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { frameSizes } from '#root/project/zemn.me/app/experiments/framer/sizes';
import { map } from '#root/ts/iter';

type ViewBox = [minX: number, minY: number, maxX: number, maxY: number];

type ViewBoxedElement = [viewBox: ViewBox, element: React.ReactElement];

interface Rect {
	type: 'rect';
	cx: number;
	cy: number;
	width: number;
	height: number;
	fill: string;
	stroke: string;
	key: string;
}

interface Text {
	type: 'text';
	text: string;
	cx: number;
	cy: number;
	key: string;
}

type Element = Rect | Text;

interface RenderElementsProps {
	elements: Element[];
}

function rectViewBox({
	x,
	y,
	width,
	height,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
}): ViewBox {
	const X = [x, width + x];
	const Y = [y, height + y];
	return [Math.min(...X), Math.min(...Y), Math.max(...X), Math.max(...Y)];
}

function RenderElements({ elements }: RenderElementsProps) {
	const x = elements.map(element =>
		match(element)
			.with({ type: 'rect' }, e => {
				const [x, y] = (
					[
						[e.cx, e.width],
						[e.cy, e.height],
					] as const
				).map(([c, sc]) => c - sc / 2) as [number, number];

				const { width, height, key } = e;
				const props = { x, y, width, height, key };

				return [rectViewBox(props), <rect {...props} />];
			})
			.exhaustive()
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

type RectProps = { x: number; y: number; width: number; height: number };

function rectCenterAt({ x, y, width, height }: RectProps): RectProps {
	return { x: x - width / 2, width, y: y - height / 2, height };
}

export function Framer() {
	const objs: ViewBoxedElement[] = frameSizes.map(v => {
		const d: RectProps = rectCenterAt({
			x: 0,
			y: 0,
			width: v.width.value,
			height: v.height.value,
		});
		return [rectViewBox(d), <rect {...d} key={v.name} />];
	});

	const viewBox = flattenViewBox(map(objs, x => x[0]));
	return (
		<svg
			style={{ fill: 'none', stroke: 'white' }}
			viewBox={viewBox.join(' ')}
		>
			{[...map(objs, v => v[1])]}
		</svg>
	);
}
