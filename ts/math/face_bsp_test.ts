import { describe, expect, test } from '@jest/globals';

import { type Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import { buildFaceBSP, orderFaceBSP } from '#root/ts/math/face_bsp.js';
import {
	faceDoubleSided,
	faceFill,
	faceLayer,
	faceVertices,
	perspective,
	renderedFill,
	renderFaces,
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

const crossing: StyledFace3D[] = [
	styledFace(
		[
			point<3>(-2, -2, 3),
			point<3>(2, -2, 7),
			point<3>(2, 2, 7),
			point<3>(-2, 2, 3),
		],
		'red',
		7,
		true
	),
	styledFace(
		[
			point<3>(-2, -2, 7),
			point<3>(2, -2, 3),
			point<3>(2, 2, 3),
			point<3>(-2, 2, 7),
		],
		'blue',
		7,
		true
	),
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
		for (const fragment of ordered) {
			expect(faceLayer(fragment)).toBe(7);
			expect(faceDoubleSided(fragment)).toBe(true);
		}
		for (const px of [-0.3, -0.1, 0.1, 0.3]) {
			const painted = ordered
				.filter(face => contains(faceVertices(face), px, 0))
				.at(-1);
			expect(painted && faceFill(painted)).toBe(px < 0 ? 'red' : 'blue');
		}
		const rendered = unwrap(
			renderFaces(
				ordered,
				{ position: eye, yaw: 0, pitch: 0 },
				perspective(600, 600),
				{ preserveOrder: true }
			)
		);
		expect(rendered.map(renderedFill)).toEqual(ordered.map(faceFill));
	});

	test('moving geometry is split against the static scene without mutating its tree', () => {
		const eye = point<3>(0, 0, 0);
		const tree = buildFaceBSP(crossing.slice(0, 1));
		const before = orderFaceBSP(tree, eye);
		const ordered = orderFaceBSP(tree, eye, crossing.slice(1));
		for (const px of [-0.2, 0.2]) {
			const painted = ordered
				.filter(face => contains(faceVertices(face), px, 0))
				.at(-1)!;
			expect(faceFill(painted)).toBe(px < 0 ? 'red' : 'blue');
		}
		const after = orderFaceBSP(tree, eye);
		expect(after).toEqual(before);
		expect(after[0]).toBe(before[0]);
	});

	test('same-color leaves resolve foreign geometry across all their surfaces', () => {
		const quad = (
			left: number,
			right: number,
			depth: number,
			fill: string
		) =>
			styledFace(
				[
					point<3>(left, -2, depth),
					point<3>(right, -2, depth),
					point<3>(right, 2, depth),
					point<3>(left, 2, depth),
				],
				fill,
				0,
				true
			);
		const tree = buildFaceBSP([
			quad(-2, 0, 3, '#ff0000'),
			quad(-4, 4, 8, '#ff0000'),
		]);
		const eye = point<3>(0, 0, 0);
		const ordered = orderFaceBSP(tree, eye, [quad(-4, 4, 5, '#0000ff')]);
		for (const px of [-0.2, 0.2]) {
			const painted = ordered
				.filter(face => contains(faceVertices(face), px, 0))
				.at(-1)!;
			expect(faceFill(painted)).toBe(px < 0 ? '#ff0000' : '#0000ff');
		}
		expect(orderFaceBSP(tree, eye).map(faceFill)).toEqual([
			'#ff0000',
			'#ff0000',
		]);
	});
	test('reverses traversal behind the surfaces and handles coplanar and degenerate faces', () => {
		const vertices = [
			point<3>(-1, -1, 2),
			point<3>(1, -1, 2),
			point<3>(0, 1, 2),
		];
		const near = styledFace(vertices, 'near');
		const far = styledFace(
			vertices.map(p => point<3>(x(p), y(p), 4)),
			'far'
		);
		const tree = buildFaceBSP([
			near,
			far,
			styledFace(vertices, 'decal'),
			styledFace(
				[point<3>(0, 0, 0), point<3>(0, 0, 0), point<3>(0, 0, 0)],
				'empty'
			),
		]);
		expect(orderFaceBSP(tree, point<3>(0, 0, 0)).map(faceFill)).toEqual([
			'far',
			'near',
			'decal',
		]);
		expect(orderFaceBSP(tree, point<3>(0, 0, 6)).map(faceFill)).toEqual([
			'near',
			'decal',
			'far',
		]);
	});
});
