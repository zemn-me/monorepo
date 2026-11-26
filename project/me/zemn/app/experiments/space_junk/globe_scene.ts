import {
	appendMesh,
	type OrbitCamera,
	orbitPose,
	rgb,
	sphere,
} from '#root/ts/3d/low_poly.js';
import {
	cameraSpaceTransformFromPose,
	orientationFromYawPitch,
} from '#root/ts/math/camera_pose.js';
import {
	cross,
	magnitude,
	type Point3D,
	point,
	scale,
	translate,
	x,
	y,
	z,
} from '#root/ts/math/cartesian.js';
import { rotateVector } from '#root/ts/math/quaternion.js';
import {
	cameraProjector,
	perspective,
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';
import { type Marker, surface, type Vector } from './globe_geometry.js';

export const width = 416,
	height = 376;
const focalScale = 0.95;
const focal = height * focalScale;
const radians = Math.PI / 180;
const layers = { D: 3, R: 4, C: 5, P: 6 };
const shapes = {
	P: [
		[-0.9, -0.9],
		[0.9, -0.9],
		[0.9, 0.9],
		[-0.9, 0.9],
	],
	D: [
		[-0.65, -0.5],
		[0.65, -0.5],
		[0, 0.7],
	],
	R: [
		[-1.1, -0.5],
		[0.35, 1.15],
		[1.1, 0.5],
		[-0.35, -1.15],
	],
	C: [
		[-1.25, 0],
		[0, 1.25],
		[1.25, 0],
		[0, -1.25],
	],
} as const;

// The renderer looks down +Z with Y up. From Greenwich, east must appear to the right.
function world(p: Vector) {
	return point<3>(-p.y, p.z, p.x);
}

function ribbon(
	line: Vector[],
	color: string,
	halfWidth: number,
	layer: number
) {
	const faces: StyledFace3D[] = [];
	const vertices = line.map(world);
	for (let i = 1; i < vertices.length; i++) {
		const a = vertices[i - 1]!,
			b = vertices[i]!;
		const normal = cross(a, b);
		const length = magnitude(normal);
		if (length < 1e-10) continue;
		const offset = scale<3>(normal, halfWidth / length);
		const opposite = scale<3>(offset, -1);
		// Outward winding lets the scene renderer cull the hidden hemisphere.
		faces.push(
			styledFace(
				[
					translate<3>(a, opposite),
					translate<3>(b, opposite),
					translate<3>(b, offset),
					translate<3>(a, offset),
				],
				color,
				layer
			)
		);
	}
	return faces;
}

// These opaque grayscale paints encode ink density in the globe’s luminance mask.
const earth: StyledFace3D[] = [];
appendMesh(earth, sphere(32, 16), rgb(0x262626), {
	position: [0, 0, 0],
	scale: [1, 1, 1],
	layer: 0,
});
for (let lat = -60; lat <= 60; lat += 30)
	earth.push(
		...ribbon(
			Array.from({ length: 181 }, (_, j) => surface(j * 2, lat)),
			'#454545',
			0.0014,
			1
		)
	);
for (let lon = 0; lon < 360; lon += 30)
	earth.push(
		...ribbon(
			Array.from({ length: 91 }, (_, j) => surface(lon, j * 2 - 90)),
			'#454545',
			0.0014,
			1
		)
	);

export function globeWorld(coastlines: Vector[][] = []) {
	return earth.concat(
		coastlines.flatMap(line => ribbon(line, '#858585', 0.0024, 2))
	);
}

export function globeCamera(
	turn: number,
	tilt: number,
	extent: number
): OrbitCamera {
	return {
		yaw: -turn * radians,
		pitch: tilt * radians,
		distance: extent * Math.hypot(1, focal / 184),
		target: [0, 0, 0],
	};
}

export function globeFrame(
	camera: OrbitCamera,
	maxRadius: number,
	solidEarth = true
) {
	const pose = orbitPose(camera);
	const toCamera = unwrap(cameraSpaceTransformFromPose(pose));
	const orientation = unwrap(orientationFromYawPitch(pose.yaw, pose.pitch));
	const right = unwrap(rotateVector(orientation, point<3>(1, 0, 0)));
	const up = unwrap(rotateVector(orientation, point<3>(0, 1, 0)));
	const projection = perspective(width, height, {
		focalScale,
		farPlane: camera.distance + maxRadius + 1,
	});
	const toScreen = cameraProjector(
		width,
		height,
		focalScale,
		projection.nearPlane
	);
	function project(p: Vector) {
		const center = world(p);
		const eye = toCamera(center);
		const depth = z(eye);
		const pixels = toScreen(eye);
		// Occlude point symbols against the solid unit Earth along the camera ray.
		const lateral2 = x(eye) ** 2 + y(eye) ** 2;
		const length2 = lateral2 + depth ** 2;
		const distance = camera.distance;
		const visible =
			depth >= projection.nearPlane &&
			depth <= projection.farPlane &&
			(!solidEarth ||
				distance * depth >= length2 ||
				distance ** 2 * lateral2 >= length2);
		return { center, x: x(pixels), y: y(pixels), depth, visible };
	}
	function symbol(
		center: Point3D,
		depth: number,
		kind: Marker['object']['kind'],
		size = 1
	) {
		// Billboard sizes are in screen pixels so a fragment is selectable at every zoom.
		const unit = (size * depth) / focal;
		const vertex = (dx: number, dy: number) =>
			point<3>(
				x(center) + unit * (dx * x(right) + dy * x(up)),
				y(center) + unit * (dx * y(right) + dy * y(up)),
				z(center) + unit * (dx * z(right) + dy * z(up))
			);
		const vertices = shapes[kind].map(([dx, dy]) => vertex(dx, dy));
		return styledFace(vertices, '#ffffff', layers[kind], true);
	}
	return {
		camera,
		projection,
		project,
		symbol,
		kmPerPixel: (6378.137 * camera.distance) / focal,
	};
}
