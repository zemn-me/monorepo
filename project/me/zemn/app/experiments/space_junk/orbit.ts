import {
	ecfToLookAngles,
	eciToEcf,
	gstime,
	jday,
	json2satrec,
	propagate,
	radiansToDegrees,
	degreesToRadians,
	twoline2satrec,
	type EcfVec3,
	type Kilometer,
	type OMMJsonObject,
	type SatRec,
} from 'satellite.js';

export interface Orbit {
	position: EcfVec3<Kilometer>;
	next: EcfVec3<Kilometer>;
	epoch: string;
	source: string;
}

interface ArchiveRecord {
	satellite_id: number;
	data_source: string;
	tle_line1?: string;
	tle_line2?: string;
	orbital_elements?: OMMJsonObject;
}

export function archivedOrbit(
	record: ArchiveRecord,
	id: number,
	time: Date
): Orbit | null {
	if (record.satellite_id !== id) return null;
	let sat: SatRec;
	if (
		record.orbital_elements &&
		Number(record.orbital_elements.NORAD_CAT_ID) === id
	) {
		sat = json2satrec(record.orbital_elements);
	} else if (
		record.tle_line1 &&
		record.tle_line2 &&
		Number(record.tle_line1.slice(2, 7)) === id &&
		Number(record.tle_line2.slice(2, 7)) === id
	) {
		sat = twoline2satrec(record.tle_line1, record.tle_line2);
	} else {
		return null;
	}
	// The nearest archived record can be years away. Keep SGP4 estimates local to its epoch.
	if (
		!Number.isFinite(sat.jdsatepoch) ||
		Math.abs(jday(time) - sat.jdsatepoch) > 3
	)
		return null;
	const later = new Date(time.getTime() + 1000);
	const a = propagate(sat, time);
	const b = propagate(sat, later);
	if (!a || !b) return null;
	const position = eciToEcf(a.position, gstime(time));
	const next = eciToEcf(b.position, gstime(later));
	if (
		![...Object.values(position), ...Object.values(next)].every(
			Number.isFinite
		)
	)
		return null;
	return {
		position,
		next,
		source: record.data_source,
		epoch: new Date((sat.jdsatepoch - 2440587.5) * 86400000).toISOString(),
	};
}

export function lookFrom(orbit: Orbit, latitude: number, longitude: number) {
	const observer = {
		latitude: degreesToRadians(latitude),
		longitude: degreesToRadians(longitude),
		height: 0,
	};
	const { azimuth, elevation } = ecfToLookAngles(observer, orbit.position);
	const later = ecfToLookAngles(observer, orbit.next).elevation;
	return {
		azimuth: radiansToDegrees(azimuth),
		elevation: radiansToDegrees(elevation),
		rising: later > elevation,
	};
}
