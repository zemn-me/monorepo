import { describe, expect, test } from '@jest/globals';

import {
	cameraSpacePointFromPose,
	cameraSpaceTransformFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, x, y, z } from '#root/ts/math/cartesian.js';
import {
	clipPolygonToDepth,
	groundPointFromScreen,
	perspective,
	projectCameraPoint,
	projectWorldPoint,
	type RenderedFace2D,
	renderedFill,
	renderedPath,
	renderedSource,
	renderFaces,
	renderSegments,
	type StyledFace3D,
	type StyledSegment3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

describe('wireframe_render', () => {
	test('projectCameraPoint keeps a forward point at screen centre', () => {
		const projected = projectCameraPoint(
			point<3>(0, 0, 10),
			perspective(800, 600)
		);

		expect(projected[0]![0]!).toBeCloseTo(400, 5);
		expect(projected[1]![0]!).toBeCloseTo(300, 5);
	});

	test('projectWorldPoint returns null behind the near plane', () => {
		const pose: YawPitchPose = {
			position: point<3>(0, 0, 0),
			yaw: 0,
			pitch: 0,
		};

		expect(
			unwrap(
				projectWorldPoint(
					point<3>(0, 0, -1),
					pose,
					perspective(800, 600)
				)
			)
		).toBeNull();
	});

	test('renderSegments renders visible geometry in front of the camera', () => {
		const pose: YawPitchPose = {
			position: point<3>(0, 1.8, -18),
			yaw: 0,
			pitch: 0,
		};
		const scene: StyledSegment3D[] = [
			Object.assign(
				[point<3>(-1, 1.8, -10), point<3>(1, 1.8, -10)] as const,
				{ stroke: '#fff', width: 1, opacity: 1 }
			),
		];

		const rendered = unwrap(
			renderSegments(scene, pose, perspective(800, 600))
		);

		expect(rendered).toHaveLength(1);
		expect(rendered[0]!.x1).toBeLessThan(rendered[0]!.x2);
	});
});

describe('filled SVG faces', () => {
	const pose: YawPitchPose = {
		position: point<3>(0, 0, 0),
		yaw: 0,
		pitch: 0,
	};
	const triangle = [
		point<3>(-1, -1, 3),
		point<3>(0, 1, 3),
		point<3>(1, -1, 3),
	];
	test('clips a face crossing the near plane without discarding its visible portion', () => {
		const clipped = clipPolygonToDepth(
			[point<3>(0, 1, -1), point<3>(-1, -1, 2), point<3>(1, -1, 2)],
			0.1,
			true
		);
		expect(clipped).toHaveLength(4);
		for (const vertex of clipped)
			expect(z(vertex)).toBeGreaterThanOrEqual(0.1);
	});
	test('culls back faces and geometry beyond the far plane', () => {
		const rendered = unwrap(
			renderFaces(
				[
					styledFace(triangle, '#ff0'),
					styledFace([...triangle].reverse(), '#f00'),
					styledFace(
						triangle.map(p => point<3>(x(p), y(p), 100)),
						'#00f'
					),
				],
				pose,
				perspective(800, 600)
			)
		);
		expect(rendered).toHaveLength(1);
		expect(renderedFill(rendered[0]!)).toBe('#ff0');
		expect(renderedPath(rendered[0]!)).toMatch(/^M.*L.*L.*Z$/);
		expect(renderedPath(rendered[0]!)).not.toMatch(/NaN|Infinity/);
	});
	test('functional faces retain source identity through projection caching', () => {
		const face = styledFace(triangle, 'gold', 7);
		const cache = new WeakMap<StyledFace3D, RenderedFace2D | null>();
		const projection = perspective(800, 600);
		const first = unwrap(
			renderFaces([face], pose, projection, { cache })
		)[0]!;
		const second = unwrap(
			renderFaces([face], pose, projection, { cache })
		)[0]!;
		expect(second).toBe(first);
		expect(renderedSource(second)).toBe(face);
		expect(
			second((_source, _path, fill, depth, layer) => [fill, depth, layer])
		).toEqual(['gold', 3, 7]);
		// Equal geometry is a separate cache entry; callers can replace immutable records.
		const replacement = styledFace(triangle, 'blue', 8);
		const next = unwrap(
			renderFaces([replacement], pose, projection, { cache })
		)[0]!;
		expect(renderedSource(next)).toBe(replacement);
		expect(renderedFill(next)).toBe('blue');
	});
	test('orders solids by depth and keeps terrain decals in their own layers', () => {
		const rendered = unwrap(
			renderFaces(
				[
					styledFace(triangle, 'near'),
					styledFace(
						triangle.map(p => point<3>(x(p), y(p), 5)),
						'far'
					),
					styledFace(triangle, 'terrain', -1),
				],
				pose,
				perspective(800, 600)
			)
		);
		expect(rendered.map(renderedFill)).toEqual(['terrain', 'far', 'near']);
	});
	test('compiled scene transforms agree with the existing quaternion camera', () => {
		for (const yaw of [0, 0.4, 2.7])
			for (const pitch of [-0.8, 0, 0.6]) {
				const camera = { position: point<3>(3, 4, -7), yaw, pitch };
				const transform = unwrap(cameraSpaceTransformFromPose(camera));
				const world = point<3>(5, -2, 10);
				const expected = unwrap(
					cameraSpacePointFromPose(world, camera)
				);
				const actual = transform(world);
				expect(x(actual)).toBeCloseTo(x(expected), 8);
				expect(y(actual)).toBeCloseTo(y(expected), 8);
				expect(z(actual)).toBeCloseTo(z(expected), 8);
			}
	});
	test('ground picking reverses projection after rotating and resizing the camera', () => {
		const camera = { position: point<3>(3, 5, -10), yaw: 0.2, pitch: 0.4 };
		for (const [width, height] of [
			[800, 600],
			[390, 844],
		]) {
			const projection = perspective(width!, height!);
			const world = point<3>(2, 0, 4);
			const projected = unwrap(
				projectWorldPoint(world, camera, projection)
			)!;
			const hit = unwrap(
				groundPointFromScreen(projected, camera, projection)
			)!;
			expect(x(hit)).toBeCloseTo(x(world), 8);
			expect(z(hit)).toBeCloseTo(z(world), 8);
		}
	});
});
