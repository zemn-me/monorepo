import { Temporal } from 'temporal-polyfill';

export interface SpaceObject {
	id: number;
	name: string;
	piece: string;
	kind: 'C' | 'D' | 'R';
	eva: boolean;
	start: string;
	end: string | null;
}

export interface Catalogue {
	asOf: string;
	objects: SpaceObject[];
}

export const kinds = {
	C: 'Discarded equipment',
	D: 'Breakup fragment',
	R: 'Rocket stage',
};

export function inOrbit(object: SpaceObject, day: string) {
	return (
		object.start.slice(0, 10) <= day &&
		(!object.end || day <= object.end.slice(0, 10))
	);
}

// On a boundary day a date-only entry cannot establish presence at an exact minute.
export function inOrbitAt(object: SpaceObject, minute: string) {
	const start = object.start.includes('T')
		? object.start
		: object.start + 'T23:59:59';
	return start <= minute && (!object.end || minute < object.end);
}

export function readChart(
	objects: SpaceObject[],
	birthday: Temporal.PlainDate
) {
	const day = birthday.toString();
	const matches: { object: SpaceObject; days: number }[] = [];

	const anniversaries = new Map<string, number>();
	for (const object of objects) {
		if (!inOrbit(object, day)) continue;
		const monthDay = object.start.slice(5, 10);
		let anniversary = anniversaries.get(monthDay);
		if (anniversary === undefined) {
			const month = Number(monthDay.slice(0, 2));
			const dayOfMonth = Number(monthDay.slice(3));
			// A leap-day release falls on February 28 in common years.
			const dateIn = (year: number) =>
				birthday.with({ year, month, day: dayOfMonth });
			const offsets = [-1, 0, 1].map(
				delta => birthday.until(dateIn(birthday.year + delta)).days
			);
			anniversary = offsets.reduce((a, b) =>
				Math.abs(a) <= Math.abs(b) ? a : b
			);
			anniversaries.set(monthDay, anniversary);
		}
		matches.push({ object, days: anniversary });
	}
	matches.sort(
		(a, b) =>
			Number(b.object.eva) - Number(a.object.eva) ||
			Math.abs(a.days) - Math.abs(b.days) ||
			b.object.start.localeCompare(a.object.start) ||
			a.object.id - b.object.id
	);
	return { matches };
}
