import { type Camera, defaultTurn, wrap } from './chart_camera.js';
import type { Marker, Vector } from './globe_geometry.js';
import { globeCamera, globeFrame } from './globe_scene.js';
import type { earthFixedSky } from './planets.js';
import { radians } from './zodiac.js';

const bands = { D: 1.025, R: 1.055, C: 1.085 };
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

export function chartGeometry(
	camera: Pick<Camera, 'turn' | 'tilt'>,
	extent: number,
	unfold: number,
	anchor: number,
	fixed: ReturnType<typeof earthFixedSky>
) {
	const equinox = fixed(0, 0, 1);
	const zero = Math.atan2(equinox.y, equinox.x) / radians;
	// The wheel anchors the ascendant at the left. Bring that heading around to
	// geographic longitude as the Earth and its ecliptic become visible.
	const turn =
		camera.turn + (1 - unfold) * wrap(zero + anchor + 90 - defaultTurn);
	// The renderer keeps a unit Earth mesh. Changing the camera distance and
	// all object coordinates together grows Earth out of the chart origin.
	const unit = unfold || 1;
	const frame = globeFrame(
		globeCamera(turn, camera.tilt, mix(1.41, extent, unfold) / unit),
		Infinity,
		unfold > 0
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
			radius = mix(band, Math.hypot(xy, target.z), unfold) / unit;
		}
		const parallel = radius * Math.cos(lat);
		return {
			x: parallel * Math.cos(lon),
			y: parallel * Math.sin(lon),
			z: radius * Math.sin(lat),
		};
	}

	function sky(longitude: number, band: number, latitude = 0) {
		// Planet glyphs and signs share a reference sphere for sky directions.
		const physical = unfold
			? fixed(longitude, latitude, extent * 0.9)
			: equinox;
		return frame.project(position(longitude, band, physical));
	}
	function debris(marker: Marker, longitude: number) {
		return frame.project(
			position(longitude, bands[marker.object.kind], marker)
		);
	}
	return { frame, sky, debris, unfold };
}
export type ChartGeometry = ReturnType<typeof chartGeometry>;
