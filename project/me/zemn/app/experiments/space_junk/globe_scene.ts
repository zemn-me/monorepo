import {
	appendMesh,
	type OrbitCamera,
	orbitPose,
	rgb,
	sphere,
} from '#root/ts/3d/low_poly.js';
import { cameraSpaceTransformFromPose } from '#root/ts/math/camera_pose.js';
import {
	cross,
	magnitude,
	point,
	scale,
	translate,
	x,
	y,
	z,
} from '#root/ts/math/cartesian.js';
import {
	cameraProjector,
	clipSegmentToNearPlane,
	perspective,
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';
import { equatorialRadius, radians, surface, type Vector } from './globe_geometry.js';

export const width = 416,
	height = 376;
const focalScale = 0.95;
const focal = height * focalScale;

const distancePerExtent = Math.hypot(1, focal / 184);
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
		distance: extent * distancePerExtent,
		target: [0, 0, 0],
	};
}

// Horizontal span in the plane through Earth's centre, perpendicular to the camera.
export function viewWidthKm(camera: OrbitCamera) {
	return (width * equatorialRadius * camera.distance) / focal;
}

export function globeFrame(
	camera: OrbitCamera,
	maxRadius: number,
	solidEarth = true
) {
	const pose = orbitPose(camera);
	const toCamera = unwrap(cameraSpaceTransformFromPose(pose));
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
		return {
			center,
			x: x(pixels),
			y: y(pixels),
			depth,
			visible,
			inFront: depth >= projection.nearPlane,
		};
	}
	// Solve the same perspective projection for camera distance, keeping the
	// marker just inside the nearest edge of the panned viewport.
	function extentToFrame(p: Vector, panX: number, panY: number) {
		const eye = toCamera(world(p));
		function depthAtEdge(offset: number, half: number, pan: number) {
			if (!offset) return 0;
			return (
				(focal * Math.abs(offset)) /
				(0.96 * (half - Math.sign(offset) * pan))
			);
		}
		const depth = Math.max(
			projection.nearPlane,
			depthAtEdge(x(eye), width / 2, panX),
			depthAtEdge(-y(eye), height / 2, panY)
		);
		return (camera.distance - z(eye) + depth) / distancePerExtent;
	}
	function segment(
		start: ReturnType<typeof project>,
		end: ReturnType<typeof project>
	) {
		if (start.inFront && end.inFront)
			return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
		const clipped = clipSegmentToNearPlane(
			toCamera(start.center),
			toCamera(end.center),
			projection.nearPlane
		);
		if (!clipped) return null;
		const a = toScreen(clipped[0]),
			b = toScreen(clipped[1]);
		return { x1: x(a), y1: y(a), x2: x(b), y2: y(b) };
	}

	return {
		camera,
		projection,
		project,
		extentToFrame,
		segment,
		kmPerPixel: viewWidthKm(camera) / width,
	};
}
