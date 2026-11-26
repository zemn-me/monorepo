import { ecfToEci, geodeticToEcf, gstime, jday } from 'satellite.js';
import { radians, type Marker, type Vector } from './globe_geometry.js';

export const signs = [
	'Aries',
	'Taurus',
	'Gemini',
	'Cancer',
	'Leo',
	'Virgo',
	'Libra',
	'Scorpio',
	'Sagittarius',
	'Capricorn',
	'Aquarius',
	'Pisces',
];
export const degrees = (angle: number) => ((angle % 360) + 360) % 360;
export interface Birthplace {
	latitude: number;
	longitude: number;
}
export interface Placement {
	marker: Marker;
	longitude: number;
	latitude: number;
}

export function zodiacFrame(time: Date, place?: Birthplace) {
	const sidereal = gstime(time);
	// Mean obliquity of date (USNO Circular 163, A8). SGP4 uses the mean equinox of date.
	const centuries = (jday(time) - 2451545) / 36525;
	const obliquity =
		(23 +
			26 / 60 +
			(21.448 -
				46.815 * centuries -
				0.00059 * centuries ** 2 +
				0.001813 * centuries ** 3) /
				3600) *
		radians;
	const cos = Math.cos(obliquity),
		sin = Math.sin(obliquity);
	const origin = place
		? geodeticToEcf({
				latitude: place.latitude * radians,
				longitude: place.longitude * radians,
				height: 0,
			})
		: { x: 0, y: 0, z: 0 };
	function direction(fixed: Vector) {
		const p = ecfToEci(
			{
				x: fixed.x - origin.x,
				y: fixed.y - origin.y,
				z: fixed.z - origin.z,
			},
			sidereal
		);
		const y = p.y * cos + p.z * sin;
		const z = -p.y * sin + p.z * cos;
		return {
			longitude: degrees(Math.atan2(y, p.x) / radians),
			latitude: Math.atan2(z, Math.hypot(p.x, y)) / radians,
		};
	}

	let ascendant: number | undefined;
	let houseCusps: number[] | undefined;
	if (place && Math.abs(place.latitude) < 90) {
		const theta = sidereal + place.longitude * radians;
		const lat = place.latitude * radians;
		// Intersect the local horizon with the ecliptic and choose the eastern intersection.
		const a = Math.cos(lat) * Math.cos(theta);
		const b = Math.cos(lat) * Math.sin(theta) * cos + Math.sin(lat) * sin;
		if (Math.hypot(a, b) > 1e-10) {
			const candidate = Math.atan2(a, -b);
			const east =
				-Math.sin(theta) * Math.cos(candidate) +
				Math.cos(theta) * cos * Math.sin(candidate);
			if (Math.abs(east) > 1e-10) {
				ascendant = degrees(candidate / radians + (east < 0 ? 180 : 0));
				const midheaven =
					Math.atan2(Math.sin(theta), Math.cos(theta) * cos) /
					radians;
				// Porphyry trisects each quadrant. Choose the meridian intersection
				// following the eastern horizon, including inside the polar circles.
				const fourth = degrees(midheaven - ascendant) % 180;
				if (fourth > 1e-8 && fourth < 180 - 1e-8) {
					const axes = [0, fourth, 180, fourth + 180, 360];
					houseCusps = axes
						.slice(0, 4)
						.flatMap((start, i) =>
							[0, 1, 2].map(
								third =>
									start + (third * (axes[i + 1]! - start)) / 3
							)
						);
				}
			}
		}
	}
	function house(longitude: number) {
		if (ascendant === undefined || !houseCusps) return undefined;
		const offset = degrees(longitude - ascendant);
		return houseCusps.filter(cusp => cusp <= offset).length;
	}
	return { direction, ascendant, house };
}

export function signPosition(longitude: number) {
	const value = degrees(longitude);
	return `${Math.floor((value % 30) * 10) / 10}° ${signs[Math.floor(value / 30)]}`;
}

export const aspects = [
	['Conjunction', 0],
	['Sextile', 60, [2, 3]],
	['Square', 90],
	['Trine', 120, [6, 3]],
	['Opposition', 180],
] as const;

export function nearestAspects(selected: Placement, placements: Placement[]) {
	return aspects.flatMap(([name, angle, dash]) => {
		let nearest: Placement | undefined;
		let separation = 0;
		let error = Infinity;
		for (const p of placements) {
			if (p.marker.object.id === selected.marker.object.id) continue;
			const delta = Math.abs(
				degrees(p.longitude - selected.longitude + 180) - 180
			);
			const difference = Math.abs(delta - angle);
			if (difference <= 1 && difference < error) {
				nearest = p;
				error = difference;
				separation = delta;
			}
		}
		return nearest
			? [{ name, angle, dash, placement: nearest, separation }]
			: [];
	});
}
