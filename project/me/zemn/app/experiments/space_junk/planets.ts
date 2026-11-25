import {
	Body,
	Ecliptic,
	Equator,
	GeoVector,
	MakeTime,
	Observer,
} from 'astronomy-engine';
import { aspectAngles, degrees, type Birthplace } from './zodiac.js';

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
