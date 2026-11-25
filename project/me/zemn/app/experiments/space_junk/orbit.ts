import {
	degreesToRadians,
	type EcfVec3,
	ecfToLookAngles,
	eciToEcf,
	gstime,
	jday,
	json2satrec,
	type Kilometer,
	type OMMJsonObject,
	propagate,
	radiansToDegrees,
	type SatRec,
	twoline2satrec,
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

// Keep propagation close to the epoch of the measured elements.
function usableEpoch(sat: SatRec, julianDay: number) {
	return (
		Number.isFinite(sat.jdsatepoch) &&
		Math.abs(julianDay - sat.jdsatepoch) <= 3
	);
}

function earthFixed(sat: SatRec, time: Date, siderealTime: number) {
	const state = propagate(sat, time);
	if (!state) return null;
	const point = eciToEcf(state.position, siderealTime);
	return Object.values(point).every(Number.isFinite) ? point : null;
}

export type PositionRow = [id: number, x: number, y: number, z: number];

// TLE Alpha-5 skips I and O in its leading catalog digit.
function catalogNumber(field: string) {
	if (/^\d{5}$/.test(field)) return Number(field);
	const leading = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.indexOf(field[0] ?? '');
	return leading >= 0 && /^.\d{4}$/.test(field)
		? (leading + 10) * 10000 + Number(field.slice(1))
		: NaN;
}

export function* readElements(text: string, ids?: ReadonlySet<number>) {
	const lines = text.split(/\r?\n/);
	for (let i = 1; i < lines.length; i++) {
		const a = lines[i - 1]!;
		const b = lines[i]!;
		if (
			!a.startsWith('1 ') ||
			!b.startsWith('2 ') ||
			a.length < 68 ||
			b.length < 68
		)
			continue;
		const field = a.slice(2, 7);
		const id = catalogNumber(field);
		if (!Number.isFinite(id) || field !== b.slice(2, 7)) continue;
		if (ids && !ids.has(id)) continue;
		yield { id, sat: twoline2satrec(a, b) };
	}
}

export function positionsAt(
	records: Iterable<{ id: number; sat: SatRec }>,
	time: Date
): PositionRow[] {
	const julianDay = jday(time);
	const siderealTime = gstime(time);
	const positions = new Map<number, { age: number; row: PositionRow }>();
	for (const { id, sat } of records) {
		if (!usableEpoch(sat, julianDay)) continue;
		const age = Math.abs(julianDay - sat.jdsatepoch);
		if ((positions.get(id)?.age ?? Infinity) <= age) continue;
		const p = earthFixed(sat, time, siderealTime);
		if (p)
			positions.set(id, {
				age,
				row: [id, Math.round(p.x), Math.round(p.y), Math.round(p.z)],
			});
	}
	return Array.from(positions.values(), p => p.row);
}

export function snapshotPositions(text: string, time: Date) {
	return positionsAt(readElements(text), time);
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
	if (!usableEpoch(sat, jday(time))) return null;
	const later = new Date(time.getTime() + 1000);
	const position = earthFixed(sat, time, gstime(time));
	const next = earthFixed(sat, later, gstime(later));
	if (!position || !next) return null;
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
