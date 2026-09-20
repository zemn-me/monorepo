import { expect, it } from '@jest/globals';
import { mapViewport, projectLocation } from './location_geometry.js';

it('centres a single note at neighbourhood scale', () => {
	const view = mapViewport([{ latitude: 40.7, longitude: -74 }], 640, 144);
	expect(view.zoom).toBe(13);
	expect(view.points[0]?.x).toBeCloseTo(320);
	expect(view.points[0]?.y).toBeCloseTo(72);
});
it('fits every note in a multi-continent summary', () => {
	const view = mapViewport(
		[
			{ latitude: 40.7, longitude: -74 },
			{ latitude: 51.5, longitude: 0 },
			{ latitude: -33.9, longitude: 151.2 },
		],
		320,
		144
	);
	for (const point of view.points) {
		expect(point.x).toBeGreaterThanOrEqual(24);
		expect(point.x).toBeLessThanOrEqual(296);
		expect(point.y).toBeGreaterThanOrEqual(24);
		expect(point.y).toBeLessThanOrEqual(120);
	}
});
it('keeps notes across the date line close together', () => {
	const view = mapViewport(
		[
			{ latitude: 0, longitude: 179.9 },
			{ latitude: 0, longitude: -179.9 },
		],
		640,
		144
	);
	expect(view.zoom).toBeGreaterThan(10);
	expect(
		Math.abs((view.points[0]?.x ?? 0) - (view.points[1]?.x ?? 0))
	).toBeLessThan(600);
});
it('keeps polar coordinates finite', () => {
	expect(Number.isFinite(projectLocation(90, 180).y)).toBe(true);
	expect(Number.isFinite(projectLocation(-90, -180).y)).toBe(true);
});
