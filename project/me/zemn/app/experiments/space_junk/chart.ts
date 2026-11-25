import { Temporal } from 'temporal-polyfill';

export interface SpaceObject {
	id: number;
	name: string;
	piece: string;
	kind: 'C' | 'D' | 'R' | 'P';
	eva: boolean;
	start: string;
	end: string | null;
}

export interface Catalogue {
	asOf: string;
	objects: SpaceObject[];
	originals: SpaceObject[];
}

export const kinds = {
	C: 'Discarded equipment',
	D: 'Breakup fragment',
	R: 'Rocket stage',
	P: 'Communications satellite',
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
	const inOrbitThen = objects.filter(object => inOrbit(object, day));
	const yearStart = birthday.with({ month: 1, day: 1 });
	const offsets = new Map<string, number>();
	const featured = new Map<
		SpaceObject['kind'],
		{ object: SpaceObject; days: number }
	>();
	for (const object of inOrbitThen) {
		const monthDay = object.start.slice(5, 10);
		let days = offsets.get(monthDay);
		if (days === undefined) {
			const month = Number(monthDay.slice(0, 2));
			const dayOfMonth = Number(monthDay.slice(3));
			// A leap-day release is marked on February 28 in common years.
			const candidates = [-1, 0, 1].map(delta => {
				const anniversary = yearStart.with({
					year: birthday.year + delta,
					month,
					day: dayOfMonth,
				});
				return birthday.until(anniversary).days;
			});
			days = candidates.reduce((a, b) =>
				Math.abs(a) <= Math.abs(b) ? a : b
			);
			offsets.set(monthDay, days);
		}
		const previous = featured.get(object.kind);
		// Give things dropped on spacewalks first pick among equipment. Within
		// each class choose the closest anniversary, then the latest release.
		const better =
			!previous ||
			(object.eva !== previous.object.eva
				? object.eva
				: Math.abs(days) < Math.abs(previous.days) ||
					(Math.abs(days) === Math.abs(previous.days) &&
						object.start > previous.object.start));
		if (better) featured.set(object.kind, { object, days });
	}
	return {
		count: inOrbitThen.length,
		featured: Array.from(featured.values()).sort(
			(a, b) =>
				Number(b.object.eva) - Number(a.object.eva) ||
				Math.abs(a.days) - Math.abs(b.days) ||
				a.object.id - b.object.id
		),
	};
}
