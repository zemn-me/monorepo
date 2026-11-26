import { type Camera, wrap } from './chart_camera.js';
import { radians, type Marker, type Vector } from './globe_geometry.js';
import { globeCamera, globeFrame } from './globe_scene.js';
import type { BodyPosition, earthFixedSky } from './planets.js';

const bands = { D: 1.025, R: 1.055, C: 1.085, P: 1.105 };
// Interpolate scale logarithmically from the wheel out to planetary distances.
const mixRadius = (from: number, to: number, t: number) =>
	t === 1 ? to : from * (to / from) ** t;

export function chartGeometry(
	camera: Camera,
	extent: number,
	unfold: number,
	fixed: ReturnType<typeof earthFixedSky>
) {
	const equinox = fixed(0, 0, 1);
	const zero = Math.atan2(equinox.y, equinox.x) / radians;
	// The renderer keeps a unit Earth mesh. Changing the camera distance and
	// all object coordinates together grows Earth out of the chart origin.
	const unit = unfold || 1;
	const viewRadius = mixRadius(1.41, extent, unfold) / unit;
	const frame = globeFrame(
		globeCamera(camera.turn, camera.tilt, viewRadius),
		Infinity,
		unfold > 0,
		camera
	);

	function position(longitude: number, band: number, target: Vector): Vector {
		if (unfold === 1) return target;
		const start = longitude + zero;
		let lon = start * radians,
			lat = 0,
			radius = band;
		if (unfold > 0) {
			const xy = Math.hypot(target.x, target.y);
			lon +=
				unfold *
				radians *
				wrap(Math.atan2(target.y, target.x) / radians - start);
			lat = unfold * Math.atan2(target.z, xy);
			radius = mixRadius(band, Math.hypot(xy, target.z), unfold) / unit;
		}
		const parallel = radius * Math.cos(lat);
		return {
			x: parallel * Math.cos(lon),
			y: parallel * Math.sin(lon),
			z: radius * Math.sin(lat),
		};
	}

	// Tilt the entire annulus about the equinox into the ecliptic plane.
	// Its radii stay proportional as the camera scales from wheel to Earth units.
	const inclination = Math.asin(fixed(90, 0, 1).z) * unfold;
	const cosZero = Math.cos(zero * radians),
		sinZero = Math.sin(zero * radians);
	const cosTilt = Math.cos(inclination),
		sinTilt = Math.sin(inclination);
	function ring(longitude: number, radius: number) {
		const angle = longitude * radians;
		const scale = (radius * viewRadius) / 1.41;
		const x = Math.cos(angle) * scale,
			y = Math.sin(angle) * scale;
		return frame.project({
			x: cosZero * x - sinZero * y * cosTilt,
			y: sinZero * x + cosZero * y * cosTilt,
			z: y * sinTilt,
		});
	}

	function planet(body: BodyPosition) {
		return frame.project(position(body.longitude, 0.87, body.position));
	}
	function debris(marker: Marker, longitude: number) {
		return frame.project(
			position(longitude, bands[marker.object.kind], marker)
		);
	}
	function aspectEnd(marker: Marker, longitude: number) {
		return frame.project(position(longitude, 0.97, marker));
	}
	return { frame, ring, planet, debris, aspectEnd, unfold };
}
export type ChartGeometry = ReturnType<typeof chartGeometry>;
