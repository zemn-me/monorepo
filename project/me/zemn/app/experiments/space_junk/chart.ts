import type { Temporal } from 'temporal-polyfill';
import { dayMs } from './ruler_time.js';

export interface SpaceObject {
	id: number;
	name: string;
	piece: string;
	kind: ObjectKind;
	eva: boolean;
	start: string;
	end: string | null;
}

export interface Catalogue {
	asOf: string;
	objects: SpaceObject[];
}

export const debrisTypes = ['C', 'D', 'R'] as const;
export const artificialTypes = [...debrisTypes, 'P'] as const;
export type ObjectKind = (typeof artificialTypes)[number];

export const kindLabels: Record<ObjectKind, string> = {
	C: 'Discarded equipment',
	D: 'Breakup fragments',
	R: 'Rocket stages',
	P: 'Spacecraft payloads',
};

export function matchesSearch(object: SpaceObject, term: string) {
	return `${object.name} ${object.piece} ${object.id} ${kindLabels[object.kind]}`
		.toLowerCase()
		.includes(term);
}

export function inOrbit(object: SpaceObject, day: string) {
	return (
		object.start.slice(0, 10) <= day &&
		(!object.end || day <= object.end.slice(0, 10))
	);
}

// A date-only release is certain only once that entire UTC day has passed.
export function inOrbitAt(object: SpaceObject, instant: string) {
	const released = object.start.includes('T')
		? object.start <= instant
		: object.start < instant.slice(0, 10);
	return released && (!object.end || instant < object.end);
}

export function readChart(
	objects: SpaceObject[],
	birthday: Temporal.PlainDate,
	orbitDay = birthday.toString()
) {
	const matches: { object: SpaceObject; days: number }[] = [];

	// Comparing ISO dates at UTC midnight gives calendar days even across DST.
	const birthDay = Date.parse(birthday.toString());
	for (const object of objects) {
		if (!inOrbit(object, orbitDay)) continue;
		const releaseDay = Date.parse(object.start.slice(0, 10));
		matches.push({ object, days: (releaseDay - birthDay) / dayMs });
	}
	matches.sort(
		(a, b) =>
			Math.abs(a.days) - Math.abs(b.days) ||
			b.object.start.localeCompare(a.object.start) ||
			a.object.id - b.object.id
	);
	return { matches };
}
