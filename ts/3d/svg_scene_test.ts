/** @jest-environment jsdom */
import { expect, test } from '@jest/globals';

import { type OrbitCamera } from '#root/ts/3d/low_poly.js';
import { createSVGRenderer } from '#root/ts/3d/svg_scene.js';
import { point } from '#root/ts/math/cartesian.js';
import {
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';

const camera: OrbitCamera = {
	yaw: 0,
	pitch: 0,
	distance: 10,
	target: [0, 0, 0],
};
function quad(fill: string, depth: number): StyledFace3D {
	return styledFace(
		[
			point<3>(-2, -1, depth),
			point<3>(2, -1, depth),
			point<3>(2, 1, depth),
			point<3>(-2, 1, depth),
		],
		fill,
		0,
		true
	);
}

test('moving geometry keeps the static SVG paths intact and preserves front/back paint order', () => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	let width = 800,
		height = 600;
	Object.defineProperties(svg, {
		clientWidth: { get: () => width },
		clientHeight: { get: () => height },
	});
	document.body.append(svg);
	const renderer = createSVGRenderer(svg);
	renderer.setWorld([quad('green', 0)]);
	renderer.render(camera, [quad('red', 1)]);
	const lawn = svg.querySelector('path[fill="green"]')!;
	const outline = lawn.getAttribute('d');
	const observer = new MutationObserver(() => {
		/* Inspect queued records synchronously below. */
	});
	observer.observe(svg, { subtree: true, attributes: true });
	for (let i = 0; i < 20; i++) {
		const depth = i % 2 ? 1 : -1;
		renderer.render(camera, [quad('red', depth)]);
		const paths = [...svg.querySelectorAll('path:not([display="none"])')];
		expect(paths.map(path => path.getAttribute('fill'))).toEqual(
			depth > 0 ? ['green', 'red'] : ['red', 'green']
		);
		expect(svg.querySelector('path[fill="green"]')).toBe(lawn);
		expect(lawn.getAttribute('d')).toBe(outline);
	}
	expect(
		observer.takeRecords().filter(record => record.target === lawn)
	).toHaveLength(0);
	// Camera/theme changes must still invalidate static projections and paint.
	renderer.render({ ...camera, yaw: 0.5 }, []);
	expect(svg.querySelector('path[fill="green"]')?.getAttribute('d')).not.toBe(
		outline
	);
	expect(
		observer.takeRecords().filter(record => record.target === svg)
	).toHaveLength(0);
	width = 640;
	height = 480;
	renderer.render(camera, []);
	expect(svg.getAttribute('viewBox')).toBe('0 0 640 480');
	observer.disconnect();
	renderer.setWorld([quad('blue', 0)]);
	renderer.render(camera, []);
	expect(
		[...svg.querySelectorAll('path:not([display="none"])')].map(path =>
			path.getAttribute('fill')
		)
	).toEqual(['blue']);
	renderer.dispose();
	expect(svg.children).toHaveLength(0);
	svg.remove();
});
