import { describe, expect, it } from '@jest/globals';
import { Temporal } from 'temporal-polyfill';
import { inOrbitAt, matchesSearch, readChart } from './chart.js';
import { flat as defaultCamera } from './chart_camera.js';
import { chartGeometry } from './chart_geometry.js';
import {
	catalogueMarkers,
	groundLocation,
	markerFrom,
	surface,
} from './globe_geometry.js';
import { globeCamera, globeFrame, height, width } from './globe_scene.js';
import { spatula, tle, tleLines } from './orbit_fixture.js';
import { positionsAt, readElements, snapshotPositions } from './orbit.js';

import { bodyPositions, classical, earthFixedSky, modern } from './planets.js';
import {
	dayMs,
	firstInstant,
	instantAtPosition,
	rulerPosition,
} from './ruler_time.js';
import { nearestAspects, signPosition, zodiacFrame } from './zodiac.js';

const objects = [spatula];

it('marks the orbit view width where a planet fits into the panned viewport', () => {
	const p = { x: 500, y: 2000, z: -730 };
	for (const [turn, tilt, panX, panY] of [
		[0, 0, 0, 0],
		[55, -30, 70, -50],
		[-121, 90, -32, 71],
	] as const) {
		const frame = (extent: number) =>
			globeFrame(globeCamera(turn, tilt, extent), Infinity, true, {
				panX,
				panY,
			});
		const extent = frame(1).extentToFrame(p);
		const onScreen = (scale: number) => {
			const pt = frame(extent * scale).project(p);
			return (
				pt.inFront &&
				Math.abs(pt.x + panX - width / 2) <= width / 2 &&
				Math.abs(pt.y + panY - height / 2) <= height / 2
			);
		};
		expect(onScreen(1)).toBe(true);
		expect(onScreen(0.7)).toBe(false);
	}
});

it('finds a rocket stage by its singular or plural filter label', () => {
	const stage = { ...spatula, name: 'Upper motor', kind: 'R' } as const;
	expect(matchesSearch(stage, 'rocket stages')).toBe(true);
	expect(matchesSearch(stage, 'rocket stage')).toBe(true);
	expect(matchesSearch(stage, 'payload')).toBe(false);
});

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
	it('compares release dates to the local birthday while filtering orbit coverage by UTC date', () => {
		const { matches } = readChart(
			[
				{
					...spatula,
					start: '2006-07-30',
					end: '2006-07-31T23:59',
				},
			],
			Temporal.PlainDate.from('2006-08-01'),
			'2006-07-31'
		);
		expect(matches.map(row => row.days)).toEqual([-2]);
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
	it('ranks full release dates across New Year, including older objects with a matching anniversary', () => {
		const { matches } = readChart(
			[
				{ ...spatula, id: 1, start: '1999-01-01', eva: true },
				{ ...spatula, id: 3, start: '1999-12-31', eva: false },
				{ ...spatula, id: 2, start: '1999-12-31', eva: false },
			],
			Temporal.PlainDate.from('2000-01-01')
		);
		expect(matches.map(({ object, days }) => [object.id, days])).toEqual([
			[2, -1], [3, -1], [1, -365],
		]);
	});
});

describe('historical debris positions', () => {
	it('scrubs back to the same position using one set of parsed elements', () => {
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
	it('places a daily TLE in Earth-fixed kilometres and skips stale or mismatched elements', () => {
		const time = new Date('2006-08-02T12:00:00Z');
		const windowsTle = tleLines.join('\r\n');
		const rows = snapshotPositions(windowsTle + '\r\n' + windowsTle, time);
		expect(rows).toHaveLength(1);
		// Reference SGP4 (Vallado) propagated to noon UTC, then rotated by GMST.
		expect(rows[0]).toEqual([29257, -4676, -2866, 3856]);
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
});

describe('orbital globe', () => {
	it('omits the offscreen Mars–Jupiter aspect at 60° tilt on the default chart', () => {
		const date = new Date('2006-08-01T12:00:00Z');
		const bodies = bodyPositions(classical, date);
		const mars = bodies.find(body => body.name === 'Mars')!;
		const jupiter = bodies.find(body => body.name === 'Jupiter')!;
		const fixed = earthFixedSky(date);
		const wheel = chartGeometry(defaultCamera, 1.5, 0, fixed);
		const orbit = chartGeometry(
			{ ...defaultCamera, tilt: 60 },
			1.5,
			1,
			fixed
		);

		expect(
			wheel.frame.segment(wheel.planet(mars), wheel.planet(jupiter))
		).not.toBeNull();
		expect(
			orbit.frame.segment(orbit.planet(mars), orbit.planet(jupiter))
		).toBeNull();
	});
	it('clips a crossing aspect to the panned viewport and keeps its dash phase', () => {
		const panX = 40,
			panY = -20;
		const frame = globeFrame(globeCamera(0, 0, 1.5), Infinity, true, {
			panX,
			panY,
		});
		const left = frame.project({ x: 0, y: -100, z: 0 });
		const right = frame.project({ x: 0, y: 100, z: 0 });
		const line = frame.segment(right, left, [2, 3])!;
		expect(line.x1).toBeCloseTo(width - panX);
		expect(line.x2).toBeCloseTo(-panX);
		expect(line.y1).toBeCloseTo(height / 2);
		expect(line.y2).toBeCloseTo(height / 2);
		expect(line.strokeDashoffset).toBeCloseTo(
			(right.x - (width - panX)) % 5
		);

		const north = frame.project({ x: 0, y: 0, z: 100 });
		const south = frame.project({ x: 0, y: 0, z: -100 });
		const meridian = frame.segment(north, south)!;
		expect(meridian.y1).toBeCloseTo(-panY);
		expect(meridian.y2).toBeCloseTo(height - panY);
	});
	it('plots the first ten filtered bodies with a position and confirmed flight', () => {
		const matches = Array.from({ length: 20 }, (_, id) => ({
			object: { ...spatula, id },
		}));
		matches[1]!.object.start = '2006-08-01';
		const queried: number[] = [];
		const markers = catalogueMarkers(
			matches,
			id => {
				queried.push(id);
				return id === 0 ? undefined : [id, 6778, 0, 0];
			},
			'2006-08-01T12:00'
		);
		expect(markers.map(m => m.object.id)).toEqual(
			matches.slice(2, 12).map(m => m.object.id)
		);
		expect(queried).toHaveLength(11);
	});
	it('unfolds a single placement from its wheel band to its actual Earth-fixed position', () => {
		const fixed = earthFixedSky(new Date('2006-08-01T12:00:00Z'));
		const marker = markerFrom(spatula, [spatula.id, 7200, 3210, 4500]);
		const camera = defaultCamera;
		const longitude = 70;
		const flat = chartGeometry(camera, 1.5, 0, fixed).debris(
			marker,
			longitude
		);
		const equinox = fixed(0, 0, 1);
		const a =
			(longitude * Math.PI) / 180 + Math.atan2(equinox.y, equinox.x);
		const wheel = globeFrame(
			globeCamera(camera.turn, camera.tilt, 1.41),
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
			chartGeometry(tilted, 1.5, t, fixed).debris(marker, longitude);
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
	});
	it('keeps both zodiac rims at distinct radii in the ecliptic plane', () => {
		const fixed = earthFixedSky(new Date('2006-08-01T12:00:00Z'));
		const extent = 2;
		const { frame, ring } = chartGeometry(
			{ ...defaultCamera, turn: 35, tilt: 22 },
			extent,
			1,
			fixed
		);
		for (const longitude of [0, 70, 180, 270]) {
			for (const radius of [1.205, 1.45]) {
				const expected = frame.project(
					fixed(longitude, 0, (radius * extent) / 1.41)
				);
				const point = ring(longitude, radius);
				expect(point.x).toBeCloseTo(expected.x, 5);
				expect(point.y).toBeCloseTo(expected.y, 5);
				expect(point.visible).toBe(expected.visible);
			}
		}
	});
	it('keeps the camera heading through the entire morph at either pole', () => {
		const fixed = earthFixedSky(new Date('2006-08-01T12:00:00Z'));
		for (const tilt of [-90, 90]) {
			for (const turn of [-179, 47, 179]) {
				const expected = globeCamera(turn, tilt, 1.5).yaw;
				for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
					const { frame } = chartGeometry(
						{ ...defaultCamera, turn, tilt },
						1.5,
						amount,
						fixed
					);
					expect(frame.camera.yaw).toBe(expected);
				}
			}
		}
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
		expect(earth.house(90)).toBeUndefined();
		expect(local.house(local.ascendant!)).toBe(1);
		expect(local.house(local.ascendant! - 0.01)).toBe(12);
		expect(local.house(180.01)).toBe(4);
		expect(local.house(270.01)).toBe(7);
		expect(local.house(0.01)).toBe(10);
		// Away from the equator, trisect the unequal quadrants.
		const north = zodiacFrame(time, { latitude: 50, longitude: meridian });
		const fourth = 180 - north.ascendant!;
		expect(north.house(north.ascendant! + fourth / 3 - 0.01)).toBe(1);
		expect(north.house(north.ascendant! + fourth / 3 + 0.01)).toBe(2);
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
	it('places Pluto at its geometric distance and direction independent of birthplace and zoom', () => {
		const date = new Date('2006-08-01T12:00Z');
		const [pluto] = bodyPositions([modern[2]], date);
		// JPL Horizons geometric vectors, Pluto (999) relative to Earth (399),
		// JD 2453949.0 UT. Earth-fixed axes use the same ellipsoid as the debris.
		expect(Math.abs(pluto!.distanceKm - 4_551_707_967)).toBeLessThan(
			50_000
		);
		expect(
			Math.hypot(
				pluto!.position.x + 479080,
				pluto!.position.y - 491884,
				pluto!.position.z + 195122
			)
		).toBeLessThan(10);
		const local = bodyPositions([modern[2]], date, {
			latitude: 25,
			longitude: 100,
		})[0]!;
		expect(local.position).toEqual(pluto!.position);
		for (const extent of [1.5, 800000]) {
			const scene = chartGeometry(
				{ ...defaultCamera, turn: 80, tilt: 23 },
				extent,
				1,
				earthFixedSky(date)
			);
			expect(scene.planet(local)).toEqual(
				scene.frame.project(local.position)
			);
		}
	});
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
