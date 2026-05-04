import { describe, expect, test } from '@jest/globals';

import { Bio } from '#root/project/zemn.me/bio/index.js';
import { point } from '#root/ts/math/cartesian.js';

import {
	createBioWalkMarkers,
	createBioWalkScene,
	DEFAULT_POSE,
	projectWorldPoint,
	renderScene,
} from '#root/project/zemn.me/app/experiments/bio_walk/scene.js';

describe('bio walk scene', () => {
	test('creates enough geometry for every timeline entry', () => {
		const scene = createBioWalkScene();

		expect(scene.length).toBeGreaterThan(Bio.timeline.length * 10);
	});

	test('renders visible geometry', () => {
		const scene = createBioWalkScene(Bio.timeline.slice(0, 2));
		const rendered = renderScene(scene, DEFAULT_POSE, 800, 600);

		expect(rendered.length).toBeGreaterThan(0);
	});

	test('creates one marker per timeline event in chronological order', () => {
		const markers = createBioWalkMarkers(Bio.timeline.slice(0, 8));
		const ordered = [...Bio.timeline.slice(0, 8)].sort(
			(left, right) => left.date.getTime() - right.date.getTime()
		);

		expect(markers).toHaveLength(ordered.length);
		expect(markers.map(marker => marker.event.id)).toEqual(
			ordered.map(event => event.id)
		);
	});

	test('point directly ahead projects close to viewport center', () => {
		const projected = projectWorldPoint(
			point<3>(0, DEFAULT_POSE.position[1]![0]!, 20),
			{ ...DEFAULT_POSE, position: point<3>(0, DEFAULT_POSE.position[1]![0]!, 0) },
			800,
			600
		);

		expect(projected).not.toBeNull();
		expect(projected![0]![0]!).toBeCloseTo(400, 3);
	});
});
