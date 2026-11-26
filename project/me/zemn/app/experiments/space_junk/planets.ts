import {
	Body,
	Ecliptic,
	Equator,
	GeoVector,
	HelioVector,
	KM_PER_AU,
	Rotation_EQJ_EQD,
	Vector,
	MakeTime,
	Observer,
	RotateVector,
	Rotation_ECT_EQD,
	SiderealTime,
	Spherical,
	VectorFromSphere,
} from 'astronomy-engine';
import { eciToEcf } from 'satellite.js';
import { earthRadii } from './globe_geometry.js';
import { aspectAngles, degrees, radians, type Birthplace } from './zodiac.js';

export const classical = [
	Body.Sun,
	Body.Moon,
	Body.Mercury,
	Body.Venus,
	Body.Mars,
	Body.Jupiter,
	Body.Saturn,
] as const;
export const modern = [Body.Uranus, Body.Neptune, Body.Pluto] as const;
export type ChartBody = (typeof classical)[number] | (typeof modern)[number];

export const planetGlyphs: Record<ChartBody, string> = {
	Sun: '☉',
	Moon: '☽',
	Mercury: '☿',
	Venus: '♀',
	Mars: '♂',
	Jupiter: '♃',
	Saturn: '♄',
	Uranus: '♅',
	Neptune: '♆',
	Pluto: '♇',
};

export interface BodyPosition {
	name: ChartBody;
	glyph: string;
	longitude: number;
	latitude: number;
	position: ReturnType<typeof earthRadii>;
	distanceKm: number;
}

export function bodyPositions(
	bodies: readonly ChartBody[],
	date: Date,
	place?: Birthplace
): BodyPosition[] {
	if (!bodies.length) return [];
	const time = MakeTime(date);
	const observer = place && new Observer(place.latitude, place.longitude, 0);
	const earth = HelioVector(Body.Earth, time);
	const ofDate = Rotation_EQJ_EQD(time);
	const sidereal = SiderealTime(time) * 15 * radians;
	return bodies.map(name => {
		const equatorial = observer
			? Equator(name, time, observer, false, true).vec
			: GeoVector(name, time, true);
		const { elon, elat } = Ecliptic(equatorial);
		// The wheel uses the apparent sky at the birthplace. The physical
		// scene uses both bodies at the same instant, measured from Earth's center.
		const target = HelioVector(name, time);
		const relative = new Vector(
			target.x - earth.x,
			target.y - earth.y,
			target.z - earth.z,
			time
		);
		const fixed = eciToEcf(RotateVector(ofDate, relative), sidereal);
		return {
			name,
			glyph: planetGlyphs[name],
			longitude: elon,
			latitude: elat,
			position: earthRadii({
				x: fixed.x * KM_PER_AU,
				y: fixed.y * KM_PER_AU,
				z: fixed.z * KM_PER_AU,
			}),
			distanceKm: relative.Length() * KM_PER_AU,
		};
	});
}

export function bodyAspects(positions: BodyPosition[]) {
	return positions.flatMap((a, index) =>
		positions.slice(index + 1).flatMap(b => {
			const separation = Math.abs(
				degrees(a.longitude - b.longitude + 180) - 180
			);
			const aspect = aspectAngles.find(
				([, angle]) => Math.abs(separation - angle) <= 6
			);
			return aspect ? [{ a, b, name: aspect[0], angle: aspect[1] }] : [];
		})
	);
}

// Rotate apparent ecliptic directions of date into the Earth-fixed axes of the globe.
export function earthFixedSky(date: Date) {
	const time = MakeTime(date);
	const equatorial = Rotation_ECT_EQD(time);
	const sidereal = SiderealTime(time) * 15 * radians;
	return (longitude: number, latitude: number, radius: number) => {
		const point = VectorFromSphere(
			new Spherical(latitude, longitude, radius),
			time
		);
		return eciToEcf(RotateVector(equatorial, point), sidereal);
	};
}
