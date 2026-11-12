import { expect, test } from '@jest/globals';
import type { DoomLevel, MapPoint, Sector, Side } from '#root/ts/doom/level.js';
import { canStand, EYE_HEIGHT, useDoor, walk } from '#root/ts/doom/walk.js';
import { point, x, y } from '#root/ts/math/cartesian.js';

const side = (sector: number): Side => ({
	sector,
	xOffset: 0,
	yOffset: 0,
	upper: '-',
	lower: '-',
	middle: '-',
});
const room = (floor = 0, ceiling = 3): Sector => ({
	floor,
	ceiling,
	floorTexture: '',
	ceilingTexture: '',
	light: 255,
	tag: 0,
});
function fixture(neighbor = room(), door = false): DoomLevel {
	const boundary = (a: MapPoint, b: MapPoint) => ({
		a,
		b,
		front: side(0),
		back: null,
		flags: 1,
		special: 0,
		tag: 0,
	});
	return {
		origin: [0, 0],
		walls: [],
		floors: [],
		spawn: [2, EYE_HEIGHT, 2],
		angle: 0,
		linedefs: 5,
		sectors: 2,
		textures: {},
		rooms: [room(), neighbor],
		cells: [
			{
				sector: 0,
				polygon: [
					[0, 0],
					[4, 0],
					[4, 4],
					[0, 4],
				],
			},
			{
				sector: 1,
				polygon: [
					[4, 0],
					[8, 0],
					[8, 4],
					[4, 4],
				],
			},
		],
		lines: [
			boundary([0, 0], [8, 0]),
			boundary([8, 0], [8, 4]),
			boundary([8, 4], [0, 4]),
			boundary([0, 4], [0, 0]),
			{
				a: [4, 0],
				b: [4, 4],
				front: side(0),
				back: side(1),
				flags: 4,
				special: door ? 1 : 0,
				tag: 0,
			},
		],
	};
}
const start = {
	position: point<3>(2, EYE_HEIGHT, 2),
	yaw: Math.PI / 2,
	pitch: 0,
};
test('swept movement stops a player radius before solid walls even in a long frame', () => {
	const map = fixture(),
		moved = walk(map, start, 1, 0, true, 5, new Map());
	expect(x(moved.position)).toBeLessThanOrEqual(7.75 + 1e-6);
	expect(x(moved.position)).toBeGreaterThan(7.6);
	expect(y(moved.position)).toBe(EYE_HEIGHT);
	expect(canStand(map, [-1, 2], 0, new Map())).toBe(false);
});
test('walks up Doom-sized steps and blocks ledges that are too high', () => {
	const step = walk(fixture(room(0.25)), start, 1, 0, false, 1, new Map());
	expect(x(step.position)).toBeGreaterThan(4);
	expect(y(step.position)).toBe(EYE_HEIGHT + 0.25);
	const wall = walk(fixture(room(0.5)), start, 1, 0, false, 1, new Map());
	expect(x(wall.position)).toBeLessThan(4);
});
test('closed doors block passage until used within reach', () => {
	const map = fixture(room(0, 0), true),
		doors = new Map<number, number>();
	expect(useDoor(map, start, doors)).toBe(false);
	const stopped = walk(map, start, 1, 0, false, 1, doors);
	expect(x(stopped.position)).toBeLessThan(4);
	expect(useDoor(map, stopped, doors)).toBe(true);
	const through = walk(map, stopped, 1, 0, false, 0.5, doors);
	expect(x(through.position)).toBeGreaterThan(4);
});
test('descending follows gravity and lands at the lower floor', () => {
	const map = fixture(room(-1));
	let pose = walk(map, start, 1, 0, false, 0.6, new Map());
	for (let i = 0; i < 20; i++)
		pose = walk(map, pose, 0, 0, false, 0.05, new Map());
	expect(y(pose.position)).toBeCloseTo(EYE_HEIGHT - 1);
});
