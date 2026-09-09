/** @jest-environment jsdom */
import { expect, test } from '@jest/globals';

import { orbitPose } from '#root/ts/3d/low_poly.js';
import { createSVGWireframe } from '#root/ts/3d/svg_wireframe.js';
import { point, x, y } from '#root/ts/math/cartesian.js';
import {
	perspective,
	projectWorldPoint,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

test('wireframe projection agrees with the shared camera and reuses paths across zoom, orbit and resize', () => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	let width = 800,
		height = 600;
	Object.defineProperties(svg, {
		clientWidth: { get: () => width },
		clientHeight: { get: () => height },
	});
	const start = point<3>(-2, 1, 0),
		end = point<3>(2, 1, 0),
		target = point<3>(0, 0, 0);
	createSVGWireframe(svg, [
		styleSegment(start, end, 'currentColor', 0.8, 0.85),
	])((render, dispose) => {
		const yaw = (-48.7 * Math.PI) / 180,
			pitch = (32 * Math.PI) / 180;
		render(yaw, pitch, 62, target, 2.14, 0);
		const path = svg.querySelector('path')!;
		const pose = orbitPose({ yaw, pitch, distance: 62, target: [0, 0, 0] });
		const projection = perspective(width, height, {
			focalScale: 0.95 * 2.14,
			farPlane: 212,
		});
		const a = unwrap(projectWorldPoint(start, pose, projection))!,
			b = unwrap(projectWorldPoint(end, pose, projection))!;
		const original = `M${x(a).toFixed(2)} ${y(a).toFixed(2)}L${x(b).toFixed(2)} ${y(b).toFixed(2)}`;
		expect(path.getAttribute('d')).toBe(original);
		expect(svg.querySelector('g')!.getAttribute('transform')).toBe(
			'rotate(0 400 300)'
		);
		render(yaw, pitch, 62, target, 1, 0.5);
		expect(svg.querySelector('path')).toBe(path);
		expect(path.getAttribute('d')).not.toBe(original);
		for (let i = 0; i < 100; i++) render(i / 10, pitch, 62, target, 2.14);
		expect(svg.querySelectorAll('path').length).toBeLessThanOrEqual(9);
		width = 390;
		height = 844;
		render(yaw, pitch, 62, target, 2.14);
		expect(svg.getAttribute('viewBox')).toBe('0 0 390 844');
		expect(path.getAttribute('d')).not.toBe(original);
		expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
		dispose();
		expect(svg.children).toHaveLength(0);
	});
});
