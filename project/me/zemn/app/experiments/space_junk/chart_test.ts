import { describe, expect, it } from '@jest/globals';
import { Temporal } from 'temporal-polyfill';
import { inOrbitAt, readChart, type SpaceObject } from './chart.js';
import { chartGeometry } from './chart_geometry.js';
import {
	catalogueMarkers,
	groundLocation,
	markerFrom,
	surface,
} from './globe_geometry.js';
import { globeCamera, globeFrame, height, width } from './globe_scene.js';
import {
	archivedOrbit,
	lookFrom,
	positionsAt,
	readElements,
	snapshotPositions,
} from './orbit.js';

import { bodyPositions, classical, earthFixedSky } from './planets.js';
import {
	dayMs,
	firstInstant,
	instantAtPosition,
	rulerPosition,
} from './ruler_time.js';
import { nearestAspects, signPosition, zodiacFrame } from './zodiac.js';

const spatula: SpaceObject = {
	id: 29257,
	name: 'EVA debris (spatula)',
	piece: '1998-067AJ',
	kind: 'C',
	eva: true,
	start: '2006-07-12',
	end: '2006-09-29',
};
const objects = [spatula];

describe('free flight on the birthday', () => {
	it('includes the spatula during its flight and omits it before release and after reentry', () => {
		expect(
			readChart(objects, Temporal.PlainDate.from('2006-07-04')).matches
				.length
		).toBe(0);
		expect(
			readChart(objects, Temporal.PlainDate.from('2006-08-01')).matches
		).toEqual([{ object: spatula, days: -20 }]);
		expect(
			readChart(objects, Temporal.PlainDate.from('2006-09-30')).matches
				.length
		).toBe(0);
	});
	it('counts every object sharing a class and a release date in the catalogue', () => {
		const objects = [1, 2, 3, 4, 5].map(id => ({ ...spatula, id }));
		const { matches } = readChart(
			objects,
			Temporal.PlainDate.from('2006-08-01')
		);
		expect(matches.map(row => row.object.id)).toEqual([1, 2, 3, 4, 5]);
	});
	it('compares the local birthday to anniversaries while filtering orbit coverage by UTC date', () => {
		const { matches } = readChart(
			[
				{
					...spatula,
					start: '1999-08-01',
					end: '2006-07-31T23:59',
				},
			],
			Temporal.PlainDate.from('2006-08-01'),
			'2006-07-31'
		);
		expect(matches.map(row => row.days)).toEqual([0]);
	});
	it('uses only confirmed minutes on boundary days', () => {
		expect(inOrbitAt(spatula, '2006-07-12T08:00')).toBe(false);
		expect(inOrbitAt(spatula, '2006-07-12T23:59:59.999')).toBe(false);
		expect(inOrbitAt(spatula, '2006-08-01T08:00')).toBe(true);
		expect(inOrbitAt(spatula, '2006-09-29T23:00')).toBe(false);
		expect(
			inOrbitAt(
				{ ...spatula, start: '2006-07-12T06:00' },
				'2006-07-12T06:00'
			)
		).toBe(true);
	});
	it('finds an anniversary across New Year', () => {
		const result = readChart(
			[{ ...spatula, start: '1999-12-28', end: null }],
			Temporal.PlainDate.from('2000-01-01')
		);
		expect(result.matches[0]?.days).toBe(-4);
	});
});

describe('historical sky', () => {
	// Space-Track elements from IAU CPS SatChecker; its independent ephemeris
	// for JD 2453950 at 51.48 N, 0 E gives -42.996° altitude and 334.801° azimuth.
	const record = {
		satellite_id: 29257,
		data_source: 'spacetrack',
		tle_line1:
			'1 29257U 98067AJ  06214.42846098  .00093793  00000-0  49733-3 0  9999',
		tle_line2:
			'2 29257 051.6364 308.9779 0007048 137.1293 223.0259 15.79733247  4533',
	};
	it('reproduces the archived observation from Greenwich', () => {
		const orbit = archivedOrbit(
			record,
			29257,
			new Date('2006-08-02T12:00:00Z')
		);
		expect(orbit).toBeTruthy();
		const look = lookFrom(orbit!, 51.48, 0);
		expect(look.elevation).toBeCloseTo(-43, 1);
		expect(look.azimuth).toBeCloseTo(334.8, 1);
		expect(look.rising).toBe(true);
	});
	it('scrubs back to the same position using one set of parsed elements', () => {
		const tle = [record.tle_line1, record.tle_line2].join('\n');
		const elements = [...readElements(tle, new Set([29257]))];
		const noon = new Date('2006-08-02T12:00:00Z');
		const later = new Date('2006-08-02T18:15:00Z');
		const initial = positionsAt(elements, noon);
		expect(initial).toHaveLength(1);
		expect(positionsAt(elements, later)).toEqual(
			snapshotPositions(tle, later)
		);
		expect(positionsAt(elements, noon)).toEqual(initial);
	});
	it('places a daily TLE in the same Earth-fixed frame as the Greenwich observation', () => {
		const time = new Date('2006-08-02T12:00:00Z');
		const tle = [record.tle_line1, record.tle_line2].join('\r\n');
		const rows = snapshotPositions(tle + '\r\n' + tle, time);
		expect(rows).toHaveLength(1);
		const orbit = archivedOrbit(record, 29257, time)!;
		expect(rows[0]).toEqual([
			29257,
			...[orbit.position.x, orbit.position.y, orbit.position.z].map(
				Math.round
			),
		]);
		expect(snapshotPositions(tle, new Date(+time + 60000))).not.toEqual(
			rows
		);
		expect(snapshotPositions(tle, new Date('2001-08-02T12:00Z'))).toEqual(
			[]
		);
		expect(
			snapshotPositions(tle.replace('2 29257', '2 29259'), time)
		).toEqual([]);
	});
	it('rejects distant epochs and mismatched objects', () => {
		expect(
			archivedOrbit(record, 29257, new Date('1990-01-01T00:00:00Z'))
		).toBeNull();
		expect(
			archivedOrbit(record, 9724, new Date('2006-08-02T12:00:00Z'))
		).toBeNull();
	});
});

describe('orbital globe', () => {
	it('includes positions beyond the first results page and skips objects without a position or confirmed flight', () => {
		const matches = Array.from({ length: 20 }, (_, i) => ({
			object: { ...spatula, id: i + 1 },
		}));
		matches.push({ object: { ...spatula, id: 24, start: '2006-08-01' } });
		const rows = matches
			.slice(1)
			.map(({ object }): [number, number, number, number] => [
				object.id,
				6778,
				0,
				0,
			]);
		const markers = catalogueMarkers(matches, rows, '2006-08-01T12:00');
		expect(markers.map(m => m.object.id)).toEqual(
			matches.slice(1, 20).map(m => m.object.id)
		);
	});
	it('unfolds a single placement from its wheel band to its actual Earth-fixed position', () => {
		const fixed = earthFixedSky(new Date('2006-08-01T12:00:00Z'));
		const marker = markerFrom(spatula, [spatula.id, 7200, 3210, 4500]);
		const camera = { turn: 12, tilt: 90 };
		const longitude = 70,
			ascendant = 32;
		const flat = chartGeometry(camera, 1.5, 0, ascendant, fixed).debris(
			marker,
			longitude
		);
		const a = (longitude * Math.PI) / 180;
		const wheel = globeFrame(
			globeCamera(ascendant + 90, 90, 1.41),
			2,
			false
		);
		const band = wheel.project({
			x: 1.085 * Math.cos(a),
			y: 1.085 * Math.sin(a),
			z: 0,
		});
		expect(flat.x).toBeCloseTo(band.x, 8);
		expect(flat.y).toBeCloseTo(band.y, 8);

		const tilted = { ...camera, tilt: 89 };
		const accurate = globeFrame(globeCamera(12, 89, 1.5), Infinity);
		const projected = (t: number) =>
			chartGeometry(tilted, 1.5, t, ascendant, fixed).debris(
				marker,
				longitude
			);
		expect(projected(1)).toEqual(accurate.project(marker));
		const halfway = projected(0.5);
		expect(
			Math.hypot(halfway.x - projected(0).x, halfway.y - projected(0).y)
		).toBeGreaterThan(1);
		expect(
			Math.hypot(halfway.x - projected(1).x, halfway.y - projected(1).y)
		).toBeGreaterThan(1);
		// Approaching either endpoint retains the same screen position through the change of units.
		for (const [progress, end] of [
			[0.000001, 0],
			[0.999999, 1],
		] as const) {
			expect(projected(progress).x).toBeCloseTo(projected(end).x, 2);
			expect(projected(progress).y).toBeCloseTo(projected(end).y, 2);
		}
		expect(
			chartGeometry(tilted, 1.5, 1, ascendant, fixed).sky(70, 0.87, 12)
		).toEqual(accurate.project(fixed(70, 12, 1.5 * 0.9)));
	});
	it('keeps Greenwich in front, north up and east right, and hides debris behind Earth', () => {
		const { project } = globeFrame(globeCamera(0, 0, 2), 20);
		const prime = project(surface(0, 0));
		expect(prime.x).toBeCloseTo(width / 2);
		expect(prime.y).toBeCloseTo(height / 2);
		expect(prime.visible).toBe(true);
		expect(project(surface(40, 0)).x).toBeGreaterThan(prime.x);
		expect(project(surface(0, 40)).y).toBeLessThan(prime.y);
		expect(project({ x: -1.3, y: 0.4, z: 0 }).visible).toBe(false);
		expect(project({ x: -1.3, y: 1.8, z: 0 }).visible).toBe(true);
		expect(
			globeFrame(globeCamera(180, 0, 2), 20).project({
				x: -1.3,
				y: 0.4,
				z: 0,
			}).visible
		).toBe(true);
	});
	it('preserves physical altitude and Earth-fixed longitude', () => {
		const marker = markerFrom(spatula, [29257, 0, 7378.137, 0]);
		const location = groundLocation(marker);
		expect(location.longitude).toBeCloseTo(90);
		expect(location.latitude).toBeCloseTo(0);
		expect(location.height).toBeCloseTo(1000);
		const frame = globeFrame(globeCamera(0, 0, 2), 20);
		expect(
			(frame.project(marker).x - width / 2) * frame.kmPerPixel
		).toBeCloseTo(7378.137);
	});
});

describe('birthday wheel', () => {
	const time = new Date('2000-01-01T12:00:00Z');
	// At J2000.0 Greenwich sidereal time is 280.460618 degrees. At this meridian
	// the local zenith points at the equinox and due east points at RA 90 degrees.
	const meridian = 79.539382;
	const a = (meridian * Math.PI) / 180;
	it('places the zodiac on the rotating globe with the equinox over its sidereal meridian', () => {
		const fixed = earthFixedSky(time);
		const aries = fixed(0, 0, 1);
		expect((Math.atan2(aries.y, aries.x) * 180) / Math.PI).toBeCloseTo(
			meridian,
			2
		);
		expect(aries.z).toBeCloseTo(0, 5);
		const solstice = fixed(90, 0, 1);
		expect((Math.asin(solstice.z) * 180) / Math.PI).toBeCloseTo(23.44, 2);
		const later = earthFixedSky(new Date(+time + 6 * 3600000))(0, 0, 1);
		expect((Math.atan2(later.y, later.x) * 180) / Math.PI).toBeCloseTo(
			meridian - 90.246,
			2
		);
	});
	it('orients the wheel to the eastern intersection with the horizon', () => {
		const earth = zodiacFrame(time);
		expect(earth.ascendant).toBeUndefined();
		const longitude = earth.direction({
			x: Math.cos(a),
			y: Math.sin(a),
			z: 0,
		}).longitude;
		expect(Math.min(longitude, 360 - longitude)).toBeCloseTo(0, 3);
		const local = zodiacFrame(time, { latitude: 0, longitude: meridian });
		expect(local.ascendant).toBeCloseTo(90, 4);
		expect(
			zodiacFrame(time, { latitude: 90, longitude: 0 }).ascendant
		).toBeUndefined();
		const fixed = {
			x: 6378.137 * Math.cos(a) - 500 * Math.sin(a),
			y: 6378.137 * Math.sin(a) + 500 * Math.cos(a),
			z: 0,
		};
		expect(local.direction(fixed).longitude).toBeCloseTo(90, 4);
		expect(local.direction(fixed).latitude).toBeCloseTo(-23.43929, 4);
		expect(earth.direction(fixed).longitude).toBeLessThan(5);
	});
	it('assigns signs at wraparound and chooses the nearest other object per aspect', () => {
		expect(signPosition(360)).toBe('0° Aries');
		expect(signPosition(-1)).toBe('29° Pisces');
		const placement = (id: number, longitude: number) => ({
			marker: markerFrom({ ...spatula, id }, [id, 7000, 0, 0]),
			longitude,
			latitude: 0,
		});
		const focus = placement(1, 359.8);
		const aspects = nearestAspects(focus, [
			focus,
			placement(2, 0.1),
			placement(3, 60.5),
			placement(4, 59.85),
			placement(5, 177),
		]);
		expect(
			aspects.map(a => [a.name, a.placement.marker.object.id])
		).toEqual([
			['Conjunction', 2],
			['Sextile', 4],
		]);
		expect(aspects[0]?.separation).toBeCloseTo(0.3);
	});
});

describe('linked calendar rulers', () => {
	it('aligns the middle of a year with July and divides February by its actual length', () => {
		expect(instantAtPosition('year', 2008.5)).toBe(
			Date.parse('2008-07-01T00:00Z')
		);
		for (const [year, midpoint] of [
			[2008, '2008-02-15T12:00Z'],
			[2009, '2009-02-15T00:00Z'],
		] as const) {
			const epoch = Date.parse(midpoint);
			expect(instantAtPosition('month', year * 12 + 1.5)).toBe(epoch);
			expect(rulerPosition('month', epoch)).toBe(year * 12 + 1.5);
		}
	});
	it('round-trips one timestamp across all four scales to the millisecond', () => {
		for (const unit of ['year', 'month', 'day', 'minute'] as const) {
			for (const epoch of [
				firstInstant,
				-1,
				0,
				Date.parse('2008-02-29T23:59:59.999Z'),
				Date.parse('2026-11-23T23:59:59.999Z'),
			]) {
				expect(
					instantAtPosition(unit, rulerPosition(unit, epoch))
				).toBe(epoch);
			}
		}
	});
	it('round-trips local calendar gears across DST gaps, repeated hours and fractional offsets', () => {
		for (const [zone, instants] of [
			[
				'America/New_York',
				[
					'2024-03-10T06:59:59.999Z',
					'2024-03-10T07:00Z',
					'2024-11-03T05:30Z',
					'2024-11-03T06:30Z',
				],
			],
			['Asia/Kathmandu', ['2006-07-31T18:15Z']],
			['Australia/Lord_Howe', ['2024-10-05T15:30Z']],
		] as const) {
			for (const iso of instants) {
				const epoch = Date.parse(iso);
				for (const unit of ['year', 'month', 'day', 'minute'] as const)
					expect(
						instantAtPosition(
							unit,
							rulerPosition(unit, epoch, zone),
							zone
						)
					).toBe(epoch);
			}
		}
		expect(
			instantAtPosition('month', 2006 * 12 + 7, 'Asia/Kathmandu')
		).toBe(Date.parse('2006-07-31T18:15Z'));
		const midnight = rulerPosition(
			'day',
			Date.parse('2024-03-10T05:00Z'),
			'America/New_York'
		);
		expect(Number.isInteger(midnight)).toBe(true);
		expect(instantAtPosition('day', midnight + 1, 'America/New_York')).toBe(
			Date.parse('2024-03-11T04:00Z')
		);
	});
	it('carries and borrows fractions across midnight and New Year', () => {
		const midnight = Date.parse('2007-01-01T00:00Z');
		expect(
			instantAtPosition('day', rulerPosition('day', midnight) - 0.25)
		).toBe(midnight - dayMs / 4);
		expect(
			instantAtPosition(
				'minute',
				rulerPosition('minute', midnight - 1000) + 0.1
			)
		).toBe(midnight + 5000);
	});
});

describe('traditional chart', () => {
	it('reproduces the Moon crossing a sign boundary when observed from the birthplace', () => {
		// JPL Horizons observer quantity 31, JD 2453949.0 UT, centres 500@399 and geodetic 0°, 0°, 0 km.
		const date = new Date('2006-08-01T12:00Z');
		for (const [place, longitude, latitude] of [
			[undefined, 209.43253, -2.82317],
			[{ latitude: 0, longitude: 0 }, 210.2832, -2.55361],
		] as const) {
			const moon = bodyPositions(classical, date, place).find(
				p => p.name === 'Moon'
			)!;
			expect(Math.abs(moon.longitude - longitude)).toBeLessThan(0.02);
			expect(Math.abs(moon.latitude - latitude)).toBeLessThan(0.02);
		}
	});
});
