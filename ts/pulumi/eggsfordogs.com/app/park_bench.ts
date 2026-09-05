import { performance } from 'node:perf_hooks';

import { orbitPose } from '#root/ts/3d/low_poly.js';
import { cameraSpaceTransformFromPose } from '#root/ts/math/camera_pose.js';
import {
	buildFaceBSP,
	orderFaceBSP,
	visibleFaces,
} from '#root/ts/math/face_bsp.js';
import {
	faceLayer,
	faceVertices,
	perspective,
	type RenderedFace2D,
	renderFaces,
	type StyledFace3D,
} from '#root/ts/math/wireframe_render.js';
import {
	buildActors,
	buildParkMesh,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_mesh.js';
import {
	createPark,
	stepPark,
} from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';
import { unwrap } from '#root/ts/result/result.js';

function layers(faces: readonly StyledFace3D[]): Map<number, StyledFace3D[]> {
	const result = new Map<number, StyledFace3D[]>();
	for (const face of faces) {
		const key = faceLayer(face);
		let layer = result.get(key);
		if (!layer) {
			layer = [];
			result.set(key, layer);
		}
		layer.push(face);
	}
	return result;
}

function summary(values: number[]) {
	const sorted = values.toSorted((a, b) => a - b);
	return {
		p50: sorted[Math.floor(sorted.length * 0.5)],
		p95: sorted[Math.floor(sorted.length * 0.95)],
	};
}

const pose = orbitPose({
	yaw: -0.35,
	pitch: 0.64,
	distance: 17.4,
	target: [0, 0, 0],
});
const world = new Map(
	[...layers(buildParkMesh())].map(([layer, faces]) => [
		layer,
		buildFaceBSP(faces),
	])
);
const projection = perspective(900, 700);
const cache = new WeakMap<StyledFace3D, RenderedFace2D | null>();
let park = createPark();
const timings = {
	geometryMs: [] as number[],
	cullMs: [] as number[],
	orderMs: [] as number[],
	svgMs: [] as number[],
	totalMs: [] as number[],
	polygons: [] as number[],
};
// Fixed simulation steps make comparisons independent of the machine's frame rate.
for (let i = 0; i < 100; i++) {
	park = stepPark(park, 1 / 30);
	const a = performance.now(),
		faces = buildActors(park),
		b = performance.now();
	const moving = layers(visibleFaces(faces, pose.position)),
		c = performance.now();
	const ordered = [...new Set([...world.keys(), ...moving.keys()])]
		.sort((a, b) => a - b)
		.flatMap(layer =>
			orderFaceBSP(
				world.get(layer) ?? null,
				pose.position,
				moving.get(layer) ?? []
			)
		);
	const d = performance.now();
	const rendered = unwrap(
		renderFaces(ordered, pose, projection, { preserveOrder: true, cache })
	);
	const e = performance.now();
	if (i >= 20) {
		timings.geometryMs.push(b - a);
		timings.cullMs.push(c - b);
		timings.orderMs.push(d - c);
		timings.svgMs.push(e - d);
		timings.totalMs.push(e - a);
		timings.polygons.push(rendered.length);
	}
}
const matrixSamples: number[] = [];
const vertices = buildActors(park).flatMap(face => faceVertices(face));
const transform = unwrap(cameraSpaceTransformFromPose(pose));
let guard = 0;
for (let i = 0; i < 100; i++) {
	const start = performance.now();
	for (const vertex of vertices) guard += transform(vertex)[0][0];
	if (i >= 20) matrixSamples.push(performance.now() - start);
}
process.stdout.write(
	JSON.stringify(
		{
			worldFaces: buildParkMesh().length,
			actorFaces: buildActors(park).length,
			staticFragments: [...world.values()].reduce(
				(n, tree) => n + orderFaceBSP(tree, pose.position).length,
				0
			),
			note: 'CPU geometry pipeline; excludes DOM updates and browser paint. 20 warmups, 80 samples.',
			...Object.fromEntries(
				Object.entries(timings).map(([key, values]) => [
					key,
					summary(values),
				])
			),
			matrixOnlyMs: summary(matrixSamples),
			guard,
		},
		null,
		2
	) + '\n'
);
