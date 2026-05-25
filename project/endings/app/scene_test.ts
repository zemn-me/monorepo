import { describe, expect, test } from '@jest/globals';

import {
	cameraPoseAtProgress,
	createEndingsWorld,
	cueStatesAtProgress,
	darknessAtProgress,
	renderEndingsScene,
	storyTextCompleteAtProgress,
	SVG_HEIGHT,
	SVG_WIDTH,
} from '#root/project/endings/app/scene.js';
import { x, y, z } from '#root/ts/math/cartesian.js';
import { unwrap } from '#root/ts/result/result.js';

describe('endings scroll scene', () => {
	test('moves the camera down and backward through the story', () => {
		const start = cameraPoseAtProgress(0);
		const bench = cameraPoseAtProgress(0.36);
		const end = cameraPoseAtProgress(1);

		expect(y(bench.position)).toBeLessThan(y(start.position));
		expect(z(bench.position)).toBeLessThan(z(start.position));
		expect(y(end.position)).toBeLessThan(y(bench.position));
		expect(z(end.position)).toBeLessThan(z(bench.position));
	});

	test('brings each line of copy into prominence in order', () => {
		const atStart = cueStatesAtProgress(0);
		const atBench = cueStatesAtProgress(0.31);
		const atHill = cueStatesAtProgress(0.6);
		const atUnknown = cueStatesAtProgress(0.79);
		const atBlack = cueStatesAtProgress(0.99);

		expect(atStart.find(cue => cue.id === 'sunsets')!.opacity).toBe(1);
		expect(atBench.find(cue => cue.id === 'endings')!.opacity).toBe(1);
		expect(atHill.find(cue => cue.id === 'if-sunset')!.opacity).toBe(1);
		expect(atUnknown.find(cue => cue.id === 'unknown-rise')!.opacity).toBe(
			1
		);
		expect(atBlack.find(cue => cue.id === 'tragedy')!.opacity).toBe(1);
	});

	test('keeps earlier copy visible as later lines assemble', () => {
		const atBlack = cueStatesAtProgress(0.99);

		expect(atBlack.map(cue => cue.opacity)).toEqual([1, 1, 1, 1, 1]);
	});

	test('marks story text complete only after the final line renders', () => {
		expect(storyTextCompleteAtProgress(0.98)).toBe(false);
		expect(storyTextCompleteAtProgress(0.99)).toBe(true);
	});

	test('reveals the last sentence only after blackout completes', () => {
		const beforeFullBlackout = cueStatesAtProgress(0.9);
		const afterFullBlackout = cueStatesAtProgress(0.95);

		expect(darknessAtProgress(0.9)).toBeLessThan(1);
		expect(darknessAtProgress(0.95)).toBe(1);
		expect(
			beforeFullBlackout.find(cue => cue.id === 'unknown-rise')!.opacity
		).toBe(1);
		expect(
			beforeFullBlackout.find(cue => cue.id === 'tragedy')!.opacity
		).toBe(0);
		expect(
			afterFullBlackout.find(cue => cue.id === 'tragedy')!.opacity
		).toBeGreaterThan(0);
	});

	test('renders the sun near centre at the opening pose', () => {
		const rendered = unwrap(
			renderEndingsScene(
				createEndingsWorld(),
				cameraPoseAtProgress(0),
				SVG_WIDTH,
				SVG_HEIGHT
			)
		);

		expect(rendered.sun.visible).toBe(true);
		expect(rendered.sun.cx).toBeCloseTo(SVG_WIDTH / 2, 5);
		expect(rendered.sun.cy).toBeCloseTo(SVG_HEIGHT / 2, 5);
		expect(rendered.sun.radius).toBeGreaterThan(55);
	});

	test('projects the bench and seated figures before the hill blackout', () => {
		const rendered = unwrap(
			renderEndingsScene(
				createEndingsWorld(),
				cameraPoseAtProgress(0.36),
				SVG_WIDTH,
				SVG_HEIGHT
			)
		);
		const ids = new Set(rendered.polygons.map(polygon => polygon.id));

		expect(ids.has('hill')).toBe(true);
		expect(ids.has('bench-seat')).toBe(true);
		expect(ids.has('left-head')).toBe(true);
		expect(ids.has('right-head')).toBe(true);
		expect(rendered.segments.length).toBe(2);
	});

	test('adds black tree meshes at multiple depths around the bench', () => {
		const rendered = unwrap(
			renderEndingsScene(
				createEndingsWorld(),
				cameraPoseAtProgress(0.36),
				SVG_WIDTH,
				SVG_HEIGHT
			)
		);
		const trees = rendered.polygons.filter(polygon =>
			polygon.id.includes('tree')
		);
		const ids = new Set(trees.map(polygon => polygon.id));

		expect(trees.length).toBeGreaterThan(18);
		expect(trees.every(polygon => polygon.fill === '#050303')).toBe(true);
		expect(ids.has('left-foreground-tree-trunk')).toBe(true);
		expect(ids.has('right-distant-tree-upper-boughs')).toBe(true);
	});

	test('builds each tree from filled mesh faces with actual depth', () => {
		const world = createEndingsWorld();
		const foregroundTree = world.polygons.filter(polygon =>
			polygon.id.startsWith('left-foreground-tree-')
		);
		const zCoordinates = foregroundTree.flatMap(polygon =>
			polygon.points.map(point => z(point))
		);

		expect(foregroundTree.length).toBeGreaterThan(12);
		expect(
			Math.max(...zCoordinates) - Math.min(...zCoordinates)
		).toBeGreaterThan(2);
	});

	test('places the outer tree pair lower and farther back', () => {
		const world = createEndingsWorld();
		const distantTrunks = world.polygons.filter(
			polygon =>
				polygon.id === 'left-distant-tree-trunk' ||
				polygon.id === 'right-distant-tree-trunk'
		);
		const yCoordinates = distantTrunks.flatMap(polygon =>
			polygon.points.map(point => y(point))
		);
		const xCoordinates = distantTrunks.flatMap(polygon =>
			polygon.points.map(point => x(point))
		);
		const zCoordinates = distantTrunks.flatMap(polygon =>
			polygon.points.map(point => z(point))
		);

		expect(distantTrunks).toHaveLength(2);
		expect(Math.min(...xCoordinates)).toBeLessThan(-40);
		expect(Math.max(...xCoordinates)).toBeGreaterThan(40);
		expect(Math.min(...yCoordinates)).toBeLessThan(-10);
		expect(Math.min(...zCoordinates)).toBeGreaterThan(49);
	});

	test('roots tree trunks down inside the hill silhouette', () => {
		const world = createEndingsWorld();
		const foregroundTrunks = world.polygons.filter(
			polygon =>
				polygon.id === 'left-foreground-tree-trunk' ||
				polygon.id === 'right-foreground-tree-trunk'
		);
		const lowestTrunkPoints = foregroundTrunks.flatMap(polygon =>
			polygon.points.map(point => y(point))
		);

		expect(foregroundTrunks).toHaveLength(2);
		expect(Math.min(...lowestTrunkPoints)).toBeLessThan(-10);
	});

	test('keeps the hill covering the viewport bottom when final copy begins', () => {
		const rendered = unwrap(
			renderEndingsScene(
				createEndingsWorld(),
				cameraPoseAtProgress(0.72),
				SVG_WIDTH,
				SVG_HEIGHT
			)
		);
		const hill = rendered.polygons.find(polygon => polygon.id === 'hill');
		const hillYCoordinates =
			hill?.points.split(' ').map(pair => Number(pair.split(',')[1])) ??
			[];

		expect(hill).toBeDefined();
		expect(Math.max(...hillYCoordinates)).toBeGreaterThan(SVG_HEIGHT * 1.2);
	});

	test('keeps the hill wider than very wide displays', () => {
		const wideWidth = 2400;
		const rendered = unwrap(
			renderEndingsScene(
				createEndingsWorld(),
				cameraPoseAtProgress(0.72),
				wideWidth,
				SVG_HEIGHT
			)
		);
		const hill = rendered.polygons.find(polygon => polygon.id === 'hill');
		const hillXCoordinates =
			hill?.points.split(' ').map(pair => Number(pair.split(',')[0])) ??
			[];

		expect(hill).toBeDefined();
		expect(Math.min(...hillXCoordinates)).toBeLessThan(-wideWidth * 0.1);
		expect(Math.max(...hillXCoordinates)).toBeGreaterThan(wideWidth * 1.1);
	});

	test('widens the visible upper hill ridge for wide displays', () => {
		const world = createEndingsWorld();
		const hill = world.polygons.find(polygon => polygon.id === 'hill');
		const upperRidgePoints =
			hill?.points.filter(point => y(point) > -3) ?? [];
		const upperRidgeXCoordinates = upperRidgePoints.map(point => x(point));

		expect(hill).toBeDefined();
		expect(Math.min(...upperRidgeXCoordinates)).toBeLessThan(-250);
		expect(Math.max(...upperRidgeXCoordinates)).toBeGreaterThan(250);
	});

	test('finishes in full darkness', () => {
		expect(darknessAtProgress(0.7)).toBe(0);
		expect(darknessAtProgress(1)).toBe(1);
	});
});
