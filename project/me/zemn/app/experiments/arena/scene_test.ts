import { expect, test } from '@jest/globals';

import { level } from '#root/project/me/zemn/app/experiments/arena/level.js';
import {
	createArenaScene,
	START,
	stepCamera,
} from '#root/project/me/zemn/app/experiments/arena/scene.js';
import { point, x, y, z } from '#root/ts/math/cartesian.js';
import {
	faceVertices,
	perspective,
	projectWorldPoint,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

test('builds the original shareware Hangar, including floors, stairs and walls', () => {
	expect(level.linedefs).toBe(452);
	expect(level.sectors).toBe(83);
	expect(level.walls).toHaveLength(469);
	expect(level.floors.length).toBeGreaterThan(400);
	const mesh = createArenaScene();
	expect(mesh).toHaveLength(level.walls.length + level.floors.length);
	const vertices = mesh.flatMap(faceVertices);
	expect(vertices.every(p => [x(p), y(p), z(p)].every(Number.isFinite))).toBe(
		true
	);
	expect(new Set(vertices.map(y)).size).toBeGreaterThan(10);
	// Shared vertices let the renderer transform each point once per frame.
	expect(new Set(vertices).size).toBeLessThan(vertices.length / 2);
});

test('starts at the map player start, facing north in Doom coordinates', () => {
	expect([x(START.position), y(START.position), z(START.position)]).toEqual([
		-5,
		41 / 64,
		2.5,
	]);
	const ahead = point<3>(-5, 41 / 64, -2.5);
	const projected = unwrap(
		projectWorldPoint(ahead, START, perspective(800, 600))
	)!;
	expect(x(projected)).toBeCloseTo(400);
	expect(y(projected)).toBeCloseTo(300);
});

test('flight follows yaw and diagonal movement has the same speed', () => {
	const pose = { ...START, position: point<3>(0, 0, 0), yaw: Math.PI / 2 };
	const forward = stepCamera(
		pose,
		{ forward: 1, strafe: 0, vertical: 0, sprint: false },
		1
	);
	expect(x(forward.position)).toBeCloseTo(4);
	expect(z(forward.position)).toBeCloseTo(0);
	const diagonal = stepCamera(
		pose,
		{ forward: 1, strafe: 1, vertical: 1, sprint: false },
		1
	);
	expect(
		Math.hypot(
			x(diagonal.position),
			y(diagonal.position),
			z(diagonal.position)
		)
	).toBeCloseTo(4);
	const down = stepCamera(
		pose,
		{ forward: 0, strafe: 0, vertical: -1, sprint: true },
		1
	);
	expect(y(down.position)).toBe(-12);
});
