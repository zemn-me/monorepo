import { expect, test } from '@jest/globals';
import {
	createTextureProjector,
	textureMatrix,
} from '#root/ts/3d/svg_texture.js';
import { point } from '#root/ts/math/cartesian.js';
import { perspective, styledFace } from '#root/ts/math/wireframe_render.js';

test('texture coordinates map exactly onto an affine triangle', () => {
	expect(
		textureMatrix(
			[
				[0, 0],
				[1, 0],
				[0, 1],
			],
			[
				[10, 20],
				[12, 20],
				[10, 23],
			]
		)
	).toBe('matrix(2.000000 0.000000 0.000000 3.000000 10.000000 20.000000)');
	expect(
		textureMatrix(
			[
				[0, 0],
				[0, 0],
				[1, 1],
			],
			[
				[0, 0],
				[1, 1],
				[2, 2],
			]
		)
	).toBeNull();
});
test('perspective texture subdivision clips near-plane crossings to finite screen coordinates', () => {
	const project = createTextureProjector(
		{ position: point<3>(0, 1, 0), yaw: 0, pitch: 0 },
		perspective(800, 600)
	);
	const floor = styledFace(
		[
			point<3>(-10, 0, -1),
			point<3>(10, 0, -1),
			point<3>(10, 0, 15),
			point<3>(-10, 0, 15),
		],
		'floor',
		0,
		true
	);
	const triangles = project(floor, {
		image: { width: 64, height: 64, url: '' },
		u: [64, 0, 0, 0],
		v: [0, 0, 64, 0],
		light: 1,
	});
	expect(triangles.length).toBeGreaterThan(2);
	expect(triangles.length).toBeLessThan(1024);
	expect(triangles.every(t => !/NaN|Infinity/.test(t.path + t.matrix))).toBe(
		true
	);
});
