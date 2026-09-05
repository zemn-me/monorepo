import { expect, test } from '@jest/globals';

import { orbitPose } from '#root/ts/3d/low_poly.js';
import { cameraSpaceTransformFromPose } from '#root/ts/math/camera_pose.js';
import { x, y, z } from '#root/ts/math/cartesian.js';
import {
	buildFaceBSP,
	orderFaceBSP,
	visibleFaces,
} from '#root/ts/math/face_bsp.js';
import { perspective, renderFaces } from '#root/ts/math/wireframe_render.js';
import {
	buildActors,
	buildParkMesh,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_mesh.js';
import { createPark } from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';
import { unwrap } from '#root/ts/result/result.js';

type Vertex = readonly [number, number, number];

// Independent ray reference: screen barycentrics interpolate reciprocal depth.
function hit(
	vertices: readonly Vertex[],
	px: number,
	py: number
): number | null {
	const a = vertices[0]!;
	for (let i = 1; i + 1 < vertices.length; i++) {
		const b = vertices[i]!,
			c = vertices[i + 1]!;
		const det =
			(b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
		if (Math.abs(det) < 1e-10) continue;
		const u =
			((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det;
		const v =
			((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det;
		const w = 1 - u - v;
		if (u >= 0 && v >= 0 && w >= 0)
			return 1 / (u / a[2] + v / b[2] + w / c[2]);
	}
	return null;
}

test('dog SVG colors match the nearest mesh surface around the orbit and during a walk', () => {
	const park = createPark();
	park.dogs = [{ x: 0, z: 0, heading: 0, moving: true, joy: 0 }];
	const projection = perspective(320, 320, { focalScale: 0.95 });
	let checked = 0;
	for (const pitch of [0.18, 0.64, 1.1])
		for (const yaw of [-1.4, -0.3, 0.8, 2.6]) {
			park.time += 0.17;
			const pose = orbitPose({
				yaw,
				pitch,
				distance: 3.5,
				target: [0, 0.95, 0],
			});
			const faces = visibleFaces(
				buildActors(park).filter(face => face.layer === 1000),
				pose.position
			);
			const transform = unwrap(cameraSpaceTransformFromPose(pose));
			const reference = faces.map(face => ({
				fill: face.fill,
				vertices: face.vertices.map(p => {
					const q = transform(p);
					return [
						160 + (x(q) * 304) / z(q),
						160 - (y(q) * 304) / z(q),
						z(q),
					] as Vertex;
				}),
			}));
			const ordered = orderFaceBSP(buildFaceBSP(faces), pose.position);
			const painted = unwrap(
				renderFaces(ordered, pose, projection, { preserveOrder: true })
			).map(face => ({
				fill: face.fill,
				vertices: [
					...face.path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g),
				].map(m => [Number(m[1]), Number(m[2]), 1] as Vertex),
			}));
			for (let py = 83.37; py < 240; py += 9)
				for (let px = 83.19; px < 240; px += 9) {
					let nearest = Infinity,
						expected: string | undefined;
					for (const face of reference) {
						const depth = hit(face.vertices, px, py);
						if (depth !== null && depth < nearest) {
							nearest = depth;
							expected = face.fill;
						}
					}
					if (!expected) continue;
					const actual = painted.findLast(
						face => hit(face.vertices, px, py) !== null
					)?.fill;
					expect({ yaw, pitch, px, py, fill: actual }).toEqual({
						yaw,
						pitch,
						px,
						py,
						fill: expected,
					});
					checked++;
				}
		}
	expect(checked).toBeGreaterThan(1000);
});

test('the complete park can merge moving dogs into cached scenery without invalid polygons', () => {
	const pose = orbitPose({
		yaw: -0.35,
		pitch: 0.64,
		distance: 17.4,
		target: [0, 0, 0],
	});
	const world = visibleFaces(
		buildParkMesh().filter(f => f.layer === 1000),
		pose.position
	);
	const actors = visibleFaces(
		buildActors(createPark()).filter(f => f.layer === 1000),
		pose.position
	);
	const rendered = unwrap(
		renderFaces(
			orderFaceBSP(buildFaceBSP(world), pose.position, actors),
			pose,
			perspective(800, 600),
			{ preserveOrder: true }
		)
	);
	expect(rendered.length).toBeGreaterThan(1000);
	for (const face of rendered) expect(face.path).not.toMatch(/NaN|Infinity/);
});
