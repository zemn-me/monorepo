import { describe, expect, test } from '@jest/globals';

import {
	createFrameSegments,
	createPlatonicField,
	DEFAULT_POSE,
	EYE_HEIGHT,
	FIELD_COLUMNS,
	FIELD_LAYERS,
	FIELD_ROWS,
	type MovementInput,
	PLATONIC_SHAPES,
	renderScene,
	segmentCountForSolidLimit,
	stepPlayer,
	WALK_SPEED,
	WORLD_EXTENT,
} from '#root/project/me/zemn/app/experiments/platonics/scene.js';
import { point, x } from '#root/ts/math/cartesian.js';
import { unwrap } from '#root/ts/result/result.js';

describe('platonic stress scene', () => {
	test('defines the five platonic solids with expected edge counts', () => {
		const expectedEdges = new Map([
			['tetrahedron', 6],
			['cube', 12],
			['octahedron', 12],
			['dodecahedron', 30],
			['icosahedron', 30],
		]);

		expect(PLATONIC_SHAPES).toHaveLength(5);
		for (const shape of PLATONIC_SHAPES) {
			expect(shape.edgeCount).toBe(expectedEdges.get(shape.kind));
			expect(shape.segments).toHaveLength(shape.edgeCount);
		}
	});

	test('creates a dense deterministic field', () => {
		const field = createPlatonicField();
		const kinds = new Set(field.solids.map(solid => solid.kind));

		expect(field.solidCount).toBe(
			FIELD_COLUMNS * FIELD_ROWS * FIELD_LAYERS
		);
		expect(field.segmentCount).toBeGreaterThan(6000);
		expect(kinds).toEqual(
			new Set([
				'tetrahedron',
				'cube',
				'octahedron',
				'dodecahedron',
				'icosahedron',
			])
		);
	});

	test('animation time changes solid geometry', () => {
		const field = createPlatonicField();
		const firstDynamicIndex = field.staticSegments.length;
		const atStart = createFrameSegments(field, 0)[firstDynamicIndex]!;
		const later = createFrameSegments(field, 2)[firstDynamicIndex]!;

		expect(x(atStart[0])).not.toBeCloseTo(x(later[0]), 5);
	});

	test('limits rendered solids before projection', () => {
		const field = createPlatonicField();
		const staticOnly = createFrameSegments(field, 0, 0);
		const oneSolid = createFrameSegments(field, 0, 1);

		expect(staticOnly).toHaveLength(field.staticSegments.length);
		expect(oneSolid).toHaveLength(
			field.staticSegments.length + field.solids[0]!.segments.length
		);
		expect(segmentCountForSolidLimit(field, 1)).toBe(oneSolid.length);
	});

	test('visible geometry is rendered from the default pose', () => {
		const rendered = unwrap(
			renderScene(createPlatonicField(), DEFAULT_POSE, 960, 540, 0)
		);

		expect(rendered.length).toBeGreaterThan(800);
		expect(rendered[0]!.depth).toBeGreaterThan(
			rendered[rendered.length - 1]!.depth
		);
	});

	test('moving forward follows yaw', () => {
		const input: MovementInput = {
			forward: 1,
			strafe: 0,
			sprint: false,
			jump: false,
		};
		const moved = stepPlayer(
			{
				...DEFAULT_POSE,
				position: point<3>(0, EYE_HEIGHT, 0),
				yaw: Math.PI / 2,
			},
			input,
			1
		);

		expect(moved.position[0]![0]!).toBeCloseTo(WALK_SPEED, 5);
		expect(moved.position[2]![0]!).toBeCloseTo(0, 5);
	});

	test('movement is clamped inside the field', () => {
		const moved = stepPlayer(
			{
				...DEFAULT_POSE,
				position: point<3>(WORLD_EXTENT - 0.25, EYE_HEIGHT, 0),
				yaw: Math.PI / 2,
			},
			{
				forward: 1,
				strafe: 0,
				sprint: true,
				jump: false,
			},
			1
		);

		expect(moved.position[0]![0]!).toBe(WORLD_EXTENT - 1);
	});
});
