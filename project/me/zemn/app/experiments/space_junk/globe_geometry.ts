import { constants, eciToGeodetic, radiansToDegrees } from 'satellite.js';

import { inOrbitAt, type SpaceObject } from './chart.js';
import type { PositionRow } from './orbit.js';

export const radians = constants.deg2rad;
export const equatorialRadius = 6378.137;
const polarRadius = 6356.752314245;


export interface Vector {
	x: number;
	y: number;
	z: number;
}
export interface Marker extends Vector {
	object: SpaceObject;
	fixed: Vector;
}

// The WGS84 ellipsoid becomes a unit sphere in these drawing coordinates.
export function earthRadii({ x, y, z }: Vector): Vector {
	return {
		x: x / equatorialRadius,
		y: y / equatorialRadius,
		z: z / polarRadius,
	};
}

export function markerFrom(
	object: SpaceObject,
	[, x, y, z]: PositionRow
): Marker {
	const fixed = { x, y, z };
	return { object, fixed, ...earthRadii(fixed) };
}

const maxManMadeBodies = 10;

export function catalogueMarkers(
	matches: { object: SpaceObject }[],
	positionFor: (id: number) => PositionRow | undefined,
	instant: string
) {
	const markers: Marker[] = [];
	for (const { object } of matches) {
		if (!inOrbitAt(object, instant)) continue;
		const row = positionFor(object.id);
		if (!row) continue;
		markers.push(markerFrom(object, row));
		if (markers.length === maxManMadeBodies) break;
	}
	return markers;
}

export function groundLocation(marker: Marker) {
	// The input is already Earth-fixed, so the sidereal rotation is zero.
	const p = eciToGeodetic(marker.fixed, 0);
	return {
		longitude: radiansToDegrees(p.longitude),
		latitude: radiansToDegrees(p.latitude),
		height: p.height,
	};
}

export function surface(longitude: number, latitude: number): Vector {
	const lon = longitude * radians;
	const lat = latitude * radians;
	const angle = Math.atan2(
		polarRadius * Math.sin(lat),
		equatorialRadius * Math.cos(lat)
	);
	return {
		x: Math.cos(angle) * Math.cos(lon),
		y: Math.cos(angle) * Math.sin(lon),
		z: Math.sin(angle),
	};
}
