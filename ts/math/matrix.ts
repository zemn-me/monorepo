import type { Multiply } from '#root/ts/math/type_math.js';

export type Content<W extends number, H extends number> = Array<number> & {
	length: Multiply<W, H>;
};

export type Matrix<W extends number = number, H extends number = number> = <T>(
	f: (width: W, height: H, content: Content<W, H>) => T
) => T;

function make<const W extends number, const H extends number>(
	width: W,
	height: H,
	content: Content<W, H>
): Matrix<W, H> {
	return f => f(width, height, content);
}

function checkedContent<const W extends number, const H extends number>(
	width: W,
	height: H,
	content: Array<number>
): Content<W, H> {
	const expectedLength = width * height;
	if (content.length !== expectedLength) {
		throw new Error(
			`matrix content length ${content.length} does not match ${width} * ${height} = ${expectedLength}`
		);
	}

	return content as Content<W, H>;
}

export function as<const W extends number, const H extends number>(
	width: W,
	height: H,
	content: Content<W, H>
): Matrix<W, H> {
	return make(width, height, checkedContent(width, height, content));
}

export function fromRows<const W extends number, const H extends number>(
	rows: readonly (readonly number[] & { length: W })[] & { length: H }
): Matrix<W, H> {
	const height = rows.length as H;
	const width = (rows[0]?.length ?? 0) as W;
	const content: Array<number> = [];

	for (let j = 0; j < height; j++) {
		const row = rows[j]!;
		if (row.length !== width) {
			throw new Error(
				`row ${j} has width ${row.length}; expected width ${width}`
			);
		}

		for (let i = 0; i < width; i++) content.push(row[i]!);
	}

	return make(width, height, checkedContent(width, height, content));
}

export function fromFunction<const W extends number, const H extends number>(
	width: W,
	height: H,
	f: (pos: readonly [i: number, j: number]) => number
): Matrix<W, H> {
	const content = new Array<number>(width * height);
	let index = 0;
	for (let j = 0; j < height; j++) {
		for (let i = 0; i < width; i++) {
			content[index] = f([i, j]);
			index++;
		}
	}

	return make(width, height, checkedContent(width, height, content));
}

export function size<W extends number, H extends number>(
	m: Matrix<W, H>
): [W, H] {
	return m((width, height) => [width, height]);
}

export function width<W extends number, H extends number>(
	m: Matrix<W, H>
): W {
	return m(width => width);
}

export function height<W extends number, H extends number>(
	m: Matrix<W, H>
): H {
	return m((_, height) => height);
}

export function content<W extends number, H extends number>(
	m: Matrix<W, H>
): Content<W, H> {
	return m((_, __, content) => content);
}

export function at<W extends number, H extends number>(
	m: Matrix<W, H>,
	i: number,
	j: number
): number | undefined {
	return m((width, height, content) => {
		if (i < 0 || j < 0 || i >= width || j >= height) return undefined;

		return content[j * width + i];
	});
}

export function toRows<W extends number, H extends number>(
	m: Matrix<W, H>
): number[][] {
	return m((width, height, content) => {
		const rows = new Array<Array<number>>(height);
		for (let j = 0; j < height; j++) {
			const start = j * width;
			rows[j] = content.slice(start, start + width);
		}

		return rows;
	});
}

export const map: <W extends number, H extends number>(
	m: Matrix<W, H>,
	f: (
		v: number,
		pos: readonly [i: number, j: number],
		matrix: Matrix<W, H>
	) => number
) => Matrix<W, H> = (m, f) =>
	m((width, height, content) => {
		const mapped = new Array<number>(content.length);
		let index = 0;
		for (let j = 0; j < height; j++) {
			for (let i = 0; i < width; i++) {
				mapped[index] = f(content[index]!, [i, j], m);
				index++;
			}
		}

		return make(width, height, checkedContent(width, height, mapped));
	});

export const mapWithArrayMap: <W extends number, H extends number>(
	m: Matrix<W, H>,
	f: (
		v: number,
		pos: readonly [i: number, j: number],
		matrix: Matrix<W, H>
	) => number
) => Matrix<W, H> = (m, f) =>
	m((width, height, content) =>
		make(
			width,
			height,
			checkedContent(
				width,
				height,
				content.map((value, index) =>
					f(value, [index % width, Math.floor(index / width)], m)
				)
			)
		)
	);
