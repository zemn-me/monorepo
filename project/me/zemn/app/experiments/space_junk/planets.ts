import {
	Body,
	Ecliptic,
	Equator,
	GeoVector,
	MakeTime,
	Observer,
	RotateVector,
	Rotation_ECT_EQD,
	SiderealTime,
	Spherical,
	VectorFromSphere,
} from 'astronomy-engine';
import { eciToEcf } from 'satellite.js';
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

const glyphs: Record<ChartBody, string> = {
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
}

export function bodyPositions(
	bodies: readonly ChartBody[],
	date: Date,
	place?: Birthplace
): BodyPosition[] {
	const time = MakeTime(date);
	const observer = place && new Observer(place.latitude, place.longitude, 0);
	return bodies.map(name => {
		const equatorial = observer
			? Equator(name, time, observer, false, true).vec
			: GeoVector(name, time, true);
		const { elon, elat } = Ecliptic(equatorial);
		return { name, glyph: glyphs[name], longitude: elon, latitude: elat };
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
