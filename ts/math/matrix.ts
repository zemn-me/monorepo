import type { Multiply as TypeMultiply } from '#root/ts/math/type_math.js';

export type Content<W extends number, H extends number> = Array<number> & {
	length: TypeMultiply<W, H>;
};

export type Matrix<W extends number = number, H extends number = number> = <T>(
	f: (width: W, height: H, content: Content<W, H>) => T
) => T;

export type Square<IJ extends number = number> = Matrix<IJ, IJ>;

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

export const zero = make(0, 0, checkedContent(0, 0, []));

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

export const add: <const W extends number, const H extends number>(
	m1: Matrix<W, H>,
	m2: Matrix<W, H>
) => Matrix<W, H> = (m1, m2) =>
	m1((width, height, content1) =>
		m2((width2, height2, content2) => {
			if (width !== width2 || height !== height2) {
				throw new Error(
					`cannot add ${width}x${height} matrix to ${width2}x${height2} matrix`
				);
			}

			const content = new Array<number>(content1.length);
			for (let index = 0; index < content1.length; index++) {
				content[index] = content1[index]! + content2[index]!;
			}

			return make(width, height, checkedContent(width, height, content));
		})
	);

export const sub: <const W extends number, const H extends number>(
	m1: Matrix<W, H>,
	m2: Matrix<W, H>
) => Matrix<W, H> = (m1, m2) =>
	m1((width, height, content1) =>
		m2((width2, height2, content2) => {
			if (width !== width2 || height !== height2) {
				throw new Error(
					`cannot subtract ${width2}x${height2} matrix from ${width}x${height} matrix`
				);
			}

			const content = new Array<number>(content1.length);
			for (let index = 0; index < content1.length; index++) {
				content[index] = content1[index]! - content2[index]!;
			}

			return make(width, height, checkedContent(width, height, content));
		})
	);

export const row: <W extends number, H extends number>(
	m: Matrix<W, H>,
	r: number
) => Iterable<number> = function* (m, r) {
	const [matrixWidth, matrixHeight] = size(m);
	if (!Number.isInteger(r) || r < 0 || r >= matrixHeight) return;

	for (let i = 0; i < matrixWidth; i++) yield at(m, i, r)!;
};

export const rows: <W extends number, H extends number>(
	m: Matrix<W, H>
) => Iterable<number[]> = function* (m) {
	const [, matrixHeight] = size(m);
	for (let j = 0; j < matrixHeight; j++) yield [...row(m, j)];
};

export const col: <W extends number, H extends number>(
	m: Matrix<W, H>,
	i: number
) => Iterable<number> = function* (m, i) {
	const [matrixWidth, matrixHeight] = size(m);
	if (!Number.isInteger(i) || i < 0 || i >= matrixWidth) return;

	for (let j = 0; j < matrixHeight; j++) yield at(m, i, j)!;
};

export function mul<
	const W1 extends number,
	const H1 extends number,
	const W2 extends number,
	const H2 extends number,
>(m1: Matrix<W1, H1>, m2: Matrix<W2, H2>): Matrix<W2, H1> {
	const [width1, height1] = size(m1);
	const [width2, height2] = size(m2);

	if (Number(width1) !== Number(height2)) {
		throw new Error(
			`cannot multiply ${width1}x${height1} matrix by ${width2}x${height2} matrix`
		);
	}

	return fromFunction(width2, height1, ([i, j]) => {
		let total = 0;
		for (let k = 0; k < width1; k++) {
			total += at(m1, k, j)! * at(m2, i, k)!;
		}

		return total;
	}) as Matrix<W2, H1>;
}

export const transpose: <W extends number, H extends number>(
	m: Matrix<W, H>
) => Matrix<H, W> = <W extends number, H extends number>(m: Matrix<W, H>) => {
	const [matrixWidth, matrixHeight] = size(m);

	return fromFunction(matrixHeight, matrixWidth, ([i, j]) => at(m, j, i)!);
};

export const identity: <W extends number, H extends number>(
	width: W,
	height: H
) => Matrix<W, H> = (width, height) =>
	fromFunction(width, height, ([i, j]) => (i === j ? 1 : 0));

function determinantRows(rows: readonly (readonly number[])[]): number {
	const ij = rows.length;

	if (ij === 0) return 0;
	if (ij === 1) return rows[0]![0]!;

	if (ij === 2) {
		const [[a, b], [c, d]] = rows as readonly [
			readonly [number, number],
			readonly [number, number],
		];
		return a * d - b * c;
	}

	const top = rows[0]!;
	const rest = rows.slice(1);
	return top.reduce((acc, cur, ind) => {
		const sign = ind % 2 === 0 ? 1 : -1;
		const smaller = rest.map(row => row.filter((_, ri) => ri !== ind));
		return acc + cur * determinantRows(smaller) * sign;
	}, 0);
}

export const determinant: <IJ extends number>(m: Square<IJ>) => number = m =>
	determinantRows(toRows(m));

export const filter: (
	m: Matrix<number, number>,
	f: (
		v: number,
		pos: readonly [i: number, j: number],
		matrix: Matrix<number, number>
	) => boolean
) => number[][] = (m, f) =>
	m((width, height, content) => {
		const filteredRows: number[][] = [];

		for (let j = 0; j < height; j++) {
			const filteredRow: number[] = [];
			for (let i = 0; i < width; i++) {
				const value = content[j * width + i]!;
				if (f(value, [i, j], m)) filteredRow.push(value);
			}

			if (filteredRow.length !== 0) filteredRows.push(filteredRow);
		}

		return filteredRows;
	});

export const minors: <IJ extends number>(s: Square<IJ>) => Square<IJ> = s => {
	const [ij] = size(s);
	const rows = toRows(s);

	return fromFunction(ij, ij, ([column, row]) => {
		const smaller = rows
			.filter((_, sourceRow) => sourceRow !== row)
			.map(source =>
				source.filter((_, sourceColumn) => sourceColumn !== column)
			);

		return determinantRows(smaller);
	});
};

export const checkerboard: <W extends number, H extends number>(
	m: Matrix<W, H>
) => Matrix<W, H> = m =>
	map(m, (n, [column, row]) => ((column + row) % 2 === 0 ? n : -n));

export const inverse: <IJ extends number>(m: Square<IJ>) => Square<IJ> = m => {
	const d = 1 / determinant(m);

	return map(transpose(checkerboard(minors(m))), n => d * n);
};

export function fromVec<const L extends number>(
	v: readonly number[] & { length: L }
): Matrix<1, L> {
	return fromRows(
		v.map(value => [value]) as unknown as readonly (readonly number[] & {
			length: 1;
		})[] & { length: L }
	);
}

export function is(v: readonly (readonly number[])[]): boolean {
	return v.every((row, _, rows) => row.length === rows[0]!.length);
}

export function must(v: readonly (readonly number[])[]): void {
	if (!is(v)) throw new Error(`${JSON.stringify(v)} is not a valid matrix`);
}
