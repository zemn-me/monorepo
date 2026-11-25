import { Temporal } from 'temporal-polyfill';

// The three examples in the November 2019 space-junk star chart thread.
export const objects = [
	{
		name: 'COSMOS 886 fragment',
		designator: '1976-126V',
		source: 'https://www.satcat.com/sats/9724',
		launched: Temporal.PlainDate.from('1976-12-27'),
		description: 'A shard of the Soviet COSMOS 886 satellite.',
		reading: 'Even the smallest piece of you has a trajectory of its own.',
	},
	{
		name: 'STTW-T1',
		designator: '1984-008A',
		source: 'https://www.unoosa.org/pdf/limited/c2/AC105_C2_L255E.pdf#page=21',
		launched: Temporal.PlainDate.from('1984-01-29'),
		description:
			'A Chinese communications satellite that missed its intended orbit.',
		reading:
			'You can end up somewhere unexpected and still have something to say.',
	},
	{
		name: 'Delta II rocket body',
		designator: '2009-011C',
		source: 'https://www.unoosa.org/documents/pdf/ser571E.pdf',
		launched: Temporal.PlainDate.from('2009-03-07'),
		description:
			'The spent second stage from the launch of the Kepler space telescope.',
		reading:
			'You have a gift for getting other people where they need to go.',
	},
] as const;

export type SpaceObject = (typeof objects)[number];

export function daysFromBirthday(
	birthday: Temporal.PlainDate,
	launch: Temporal.PlainDate
) {
	const anniversary = launch.with({ year: birthday.year });
	// Across New Year, the nearest anniversary can be in a different year.
	const offsets = [
		anniversary.subtract({ years: 1 }),
		anniversary,
		anniversary.add({ years: 1 }),
	].map(date => birthday.until(date).days);
	return offsets.reduce((a, b) => (Math.abs(a) <= Math.abs(b) ? a : b));
}

export function readChart(birthday: Temporal.PlainDate) {
	const readings = objects.map(object => ({
		object,
		days: daysFromBirthday(birthday, object.launched),
	}));
	const closest = Math.min(...readings.map(({ days }) => Math.abs(days)));
	return readings.filter(({ days }) => Math.abs(days) === closest);
}
