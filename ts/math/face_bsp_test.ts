import { describe, expect, test } from '@jest/globals';

import { type Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import { buildFaceBSP, orderFaceBSP } from '#root/ts/math/face_bsp.js';
import {
	perspective,
	renderFaces,
	type StyledFace3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

const crossing: StyledFace3D[] = [
	{
		fill: 'red',
		doubleSided: true,
		vertices: [
			point<3>(-2, -2, 3),
			point<3>(2, -2, 7),
			point<3>(2, 2, 7),
			point<3>(-2, 2, 3),
		],
	},
	{
		fill: 'blue',
		doubleSided: true,
		vertices: [
			point<3>(-2, -2, 7),
			point<3>(2, -2, 3),
			point<3>(2, 2, 3),
			point<3>(-2, 2, 7),
		],
	},
];

function contains(
	vertices: readonly Point3D[],
	px: number,
	py: number
): boolean {
	const signs = vertices.map((p, i) => {
		const q = vertices[(i + 1) % vertices.length]!;
		const ax = x(p) / z(p),
			ay = y(p) / z(p),
			bx = x(q) / z(q),
			by = y(q) / z(q);
		return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
	});
	return signs.every(s => s >= 0) || signs.every(s => s <= 0);
}

describe('SVG polygon ordering', () => {
	test('splits intersecting surfaces so each side paints the correct color', () => {
		const eye = point<3>(0, 0, 0);
		const ordered = orderFaceBSP(buildFaceBSP(crossing), eye);
		expect(ordered.length).toBeGreaterThan(crossing.length);
		for (const px of [-0.3, -0.1, 0.1, 0.3]) {
			const painted = ordered
				.filter(face => contains(face.vertices, px, 0))
				.at(-1);
			expect(painted?.fill).toBe(px < 0 ? 'red' : 'blue');
		}
		const rendered = unwrap(
			renderFaces(
				ordered,
				{ position: eye, yaw: 0, pitch: 0 },
				perspective(600, 600),
				{ preserveOrder: true }
			)
		);
		expect(rendered.map(face => face.fill)).toEqual(
			ordered.map(face => face.fill)
		);
	});

	test('moving geometry is split against the static scene without mutating its tree', () => {
		const eye = point<3>(0, 0, 0);
		const tree = buildFaceBSP(crossing.slice(0, 1));
		const before = JSON.stringify(tree);
		const ordered = orderFaceBSP(tree, eye, crossing.slice(1));
		expect(
			ordered.filter(face => contains(face.vertices, -0.2, 0)).at(-1)
				?.fill
		).toBe('red');
		expect(
			ordered.filter(face => contains(face.vertices, 0.2, 0)).at(-1)?.fill
		).toBe('blue');
		expect(JSON.stringify(tree)).toBe(before);
	});

	test('reverses traversal behind the surfaces and handles coplanar and degenerate faces', () => {
		const near = {
			fill: 'near',
			vertices: [
				point<3>(-1, -1, 2),
				point<3>(1, -1, 2),
				point<3>(0, 1, 2),
			],
		};
		const far = {
			...near,
			fill: 'far',
			vertices: near.vertices.map(p => point<3>(x(p), y(p), 4)),
		};
		const tree = buildFaceBSP([
			near,
			far,
			{ ...near, fill: 'decal' },
			{
				fill: 'empty',
				vertices: [
					point<3>(0, 0, 0),
					point<3>(0, 0, 0),
					point<3>(0, 0, 0),
				],
			},
		]);
		expect(
			orderFaceBSP(tree, point<3>(0, 0, 0)).map(face => face.fill)
		).toEqual(['far', 'near', 'decal']);
		expect(
			orderFaceBSP(tree, point<3>(0, 0, 6)).map(face => face.fill)
		).toEqual(['near', 'decal', 'far']);
	});
});
