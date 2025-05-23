import { isNorthernHemisphere } from "#root/ts/time/hemisphere.js";

export const
	winter = Symbol('winter'),
	spring = Symbol('spring'),
	summer = Symbol('summer'),
	autumn = Symbol('autumn');

export type Season =
	typeof winter | typeof spring |
	typeof summer | typeof autumn;

const northernSeasons = [
	winter, // January
	winter, // February
	spring, // March
	spring, // April
	summer, // May
    summer, // June
	summer, // July
	summer, // August
	autumn, // September
	autumn, // October
	autumn, // November
	winter, // December
] as const;


// Dynamically calculate the Southern Hemisphere seasons by rotating the array
const southernSeasons = [
    ...northernSeasons.slice(6),
    ...northernSeasons.slice(0, 6),
] as [
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
	Season,
];

export function getSeason(
	date: Date = new Date(),
	timeZone: string | undefined = undefined,
	isNorthernHemi: boolean = isNorthernHemisphere(timeZone)): Season {

	const seasons = ([southernSeasons, northernSeasons] as const)[(+isNorthernHemi) as 0 | 1];

	const o = seasons[date.getMonth() as 0 | 1 | 2 |
		3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
	];

	return o
}

