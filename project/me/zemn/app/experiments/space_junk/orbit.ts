import {
	eciToEcf,
	gstime,
	jday,
	propagate,
	type SatRec,
	twoline2satrec,
} from 'satellite.js';

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
