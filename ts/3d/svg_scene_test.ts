/** @jest-environment jsdom */
import { expect, test } from '@jest/globals';

import { type OrbitCamera } from '#root/ts/3d/low_poly.js';
import { createSVGRenderer, renderSVGSnapshot } from '#root/ts/3d/svg_scene.js';
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

test('adopts the serialized frame without replacing its groups or paths', () => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	const host = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	const world = [quad('green', 0)];
	const actors = [quad('red', 1)];
	const markup = renderSVGSnapshot(world, actors, camera, 800, 600);
	host.innerHTML = markup;
	svg.append(host);
	svg.setAttribute('viewBox', '0 0 800 600');
	Object.defineProperties(svg, {
		clientWidth: { value: 800 },
		clientHeight: { value: 600 },
	});
	const group = host.firstElementChild;
	const paths = [...host.querySelectorAll('path')];
	const observer = new MutationObserver(() => {
		/* Records are inspected synchronously below. */
	});
	observer.observe(host, {
		subtree: true,
		childList: true,
		attributes: true,
	});
	const renderer = createSVGRenderer(svg, host);
	renderer.setWorld(world);
	renderer.render(camera, actors);
	expect(host.firstElementChild).toBe(group);
	expect([...host.querySelectorAll('path')]).toEqual(paths);
	expect(host.innerHTML).toBe(markup);
	expect(
		observer.takeRecords().filter(record => record.type === 'childList')
	).toHaveLength(0);
	// Subsequent live geometry still updates adopted nodes.
	renderer.render(camera, [quad('blue', 1)]);
	expect(paths[1]!.getAttribute('fill')).toBe('blue');
	observer.disconnect();
	renderer.dispose(true);
	expect(host.firstElementChild).toBe(group);
	// A retained pool can contain hidden paths that the next frame needs again.
	paths[1]!.setAttribute('display', 'none');
	const restarted = createSVGRenderer(svg, host);
	restarted.setWorld(world);
	restarted.render(camera, actors);
	expect([...host.querySelectorAll('path')]).toEqual(paths);
	expect(paths[1]!.hasAttribute('display')).toBe(false);
	restarted.dispose();
	expect(host.children).toHaveLength(0);
});

test('snapshot serialization escapes paint attributes instead of accepting markup', () => {
	const fill = 'red"/><script>alert(1)</script><path fill="blue&';
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.innerHTML = renderSVGSnapshot([quad(fill, 0)], [], camera, 800, 600);
	expect(svg.querySelector('script')).toBeNull();
	expect(svg.querySelectorAll('path')).toHaveLength(1);
	expect(svg.querySelector('path')!.getAttribute('fill')).toBe(fill);
});
