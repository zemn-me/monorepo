import React from 'react';

import * as vector from '#root/ts/math/vec.js';

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

export enum SVGNodeType {
	Path,
	Text,
}

export type Canvas = ReadonlyArray<Node>;

export type Scalar = number;
export type Path<
	L extends number = number,
	kind extends Cartesian | Homogenous = Cartesian,
> = vector.Vector<L, kind>;

export type Cartesian = vector.Vector<2, number>;
export type Homogenous = vector.Vector<3, number>;

export const cart2Homog: <L extends number>(
	path: Path<L, Cartesian>
) => Path<L, Homogenous> = path =>
	vector.map(path, ([x, y]) => [x!, y!, 1] as const);

export const homog2Cart: <L extends number>(
	path: Path<L, Homogenous>
) => Path<L, Cartesian> = path =>
	vector.map(path, ([x, y, w]) => [x! / w!, y! / w!] as const);

export interface LineProps
	extends Omit<PropsOf<'line'>, 'x1' | 'y1' | 'x2' | 'y2' | 'path'> {
	path: Path;
}

export const Line: (props: LineProps) => React.ReactElement = ({
	path: [pt1, pt2],
	...props
}) => {
	const [x1, y1] = pt1!;
	const [x2, y2] = pt2!;
	return (
		<line
			{...{
				x1: `${x1}%`,
				y1: `${y1}%`,
				x2: `${x2}%`,
				y2: `${y2}%`,
				...props,
			}}
		/>
	);
};

export interface TextProps extends Omit<PropsOf<'text'>, 'x' | 'y'> {
	pos: Path<1, Cartesian>;
}

export const Text: (props: TextProps) => React.ReactElement = ({
	pos: [pt],
	...props
}) => {
	const [x, y] = pt!;
	return (
		<text
			{...{
				x: `${x}%`,
				y: `${y}%`,
				...props,
			}}
		/>
	);
};
