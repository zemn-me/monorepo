import { Scalable, Scale } from '#monorepo/ts/math/scale/index.js';

interface SquareProps {
	h: number;
	v: number;
	color: string;
}

const square: Scalable<SquareProps> = {
	path({ h, v }) {
		return `h${h}v${v}h${-h}z`;
	},
	size({ h, v }) {
		return [h, v];
	},
	props({ color }) {
		return { fill: color };
	},
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const table: [Scalable<any>, string[], any, [number, number], any][] = [
	[
		square,
		['h', 'v'],
		{ h: 10, v: 20, color: 'red' },
		[20, 40],
		`h20v40h-20z`,
	],
];

describe('scale', () => {
	test.each(table)('%#', (gen, keys, cfg, [width, height], out) => {
		const scalable = Scale(gen, ...keys);
		expect(scalable.path({ ...cfg, width, height })).toEqual(out);
	});
});
