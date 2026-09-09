import { level } from '#root/project/me/zemn/app/experiments/arena/level.js';
import type { OrbitCamera } from '#root/ts/3d/low_poly.js';
import type { YawPitchPose } from '#root/ts/math/camera_pose.js';
import { point } from '#root/ts/math/cartesian.js';
import { styledFace } from '#root/ts/math/wireframe_render.js';

export const OVERVIEW: OrbitCamera = {
	target: [0, 0, 0],
	yaw: -0.3,
	pitch: 0.9,
	distance: 75,
};

export const START: YawPitchPose = {
	position: point<3>(level.spawn[0]!, level.spawn[1]!, level.spawn[2]!),
	// Doom's heading is counterclockwise from east; the renderer faces +Z.
	yaw: Math.PI / 2 + (level.angle * Math.PI) / 180,
	pitch: 0,
};

/** Immutable vertices are shared by faces so the SVG renderer can cache them. */
export function createArenaScene() {
	const vertices = new Map<string, ReturnType<typeof point<3>>>();
	return [
		...level.floors.map(face => ({ face, color: '#345451' })),
		...level.walls.map(face => ({ face, color: '#a1c4ac' })),
	].map(({ face, color }) =>
		styledFace(
			face.map(p => {
				const key = p.join(',');
				let vertex = vertices.get(key);
				if (!vertex) {
					vertex = point<3>(p[0]!, p[1]!, p[2]!);
					vertices.set(key, vertex);
				}
				return vertex;
			}),
			color,
			0,
			true
		)
	);
}
