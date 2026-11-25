import { describe, expect, it } from '@jest/globals';
import { Temporal } from 'temporal-polyfill';
import { inOrbitAt, readChart, type SpaceObject } from './chart.js';
import { archivedOrbit, lookFrom } from './orbit.js';

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
	it('counts every object sharing a class and a release date in the list and wheel', () => {
		const objects = [1, 2, 3, 4, 5].map(id => ({ ...spatula, id }));
		const { matches, releases } = readChart(
			objects,
			Temporal.PlainDate.from('2006-08-01')
		);
		expect(matches.map(row => row.object.id)).toEqual([1, 2, 3, 4, 5]);
		expect(releases[192]).toBe(5);
		expect(releases.reduce((total, count) => total + count)).toBe(5);
	});
	it('uses only confirmed minutes on boundary days', () => {
		expect(inOrbitAt(spatula, '2006-07-12T08:00')).toBe(false);
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
	it('rejects distant epochs and mismatched objects', () => {
		expect(
			archivedOrbit(record, 29257, new Date('1990-01-01T00:00:00Z'))
		).toBeNull();
		expect(
			archivedOrbit(record, 9724, new Date('2006-08-02T12:00:00Z'))
		).toBeNull();
	});
});
