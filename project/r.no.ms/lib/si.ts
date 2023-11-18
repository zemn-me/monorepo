import { isOneOf } from 'ts/guards';
import { flatten, map } from 'ts/iter';

type siDataForm = readonly (readonly [
	exponent: number,
	renderings: readonly string[],
])[];

const siData = [
	[0, []],
	[1, ['da', 'deca']],
	[2, ['h', 'hecto']],
	[3, ['k', 'kilo']],
	[6, ['M', 'mega']],
	[9, ['G', 'giga']],
	[12, ['T', 'tera']],
	[15, ['P', 'peta']],
	[18, ['E', 'exa']],
	[21, ['Z', 'zetta']],
	[24, ['Y', 'yotta']],
	[-1, ['d', 'deci']],
	[-2, ['c', 'centi']],
	[-3, ['m', 'mili']],
	[-6, ['μ', 'u', 'micro']],
	[-9, ['n', 'nano']],
	[-12, ['p', 'pico']],
	[-15, ['f', 'femto']],
	[-18, ['a', 'atto']],
	[-21, ['z', 'zepto']],
	[-24, ['y', 'yocto']],
] as const satisfies siDataForm;

type siData = typeof siData;

type exponent = siData[number][0];
type rendering = siData[number][1][number];

const multiplierMap = new Map<exponent, readonly rendering[]>(siData);
const nameMap = new Map<rendering, exponent>([
	...flatten(
		map(siData, ([exponent, renderings]) =>
			renderings.map(
				(
					rendering: rendering
				): [rendering: rendering, exponent: exponent] => [
					rendering,
					exponent,
				]
			)
		)
	),
]);

/**
 * A set of conventional exponents, since a 1daΩ isn't really
 * a thing.
 */
const canonicalExponents = new Set([
	0, 21, 18, 15, 12, 9, 6, 3, -3, -6, -9, -12, -15, -18, -21, -24,
] as const satisfies readonly exponent[]);

export type canonicalExponent = typeof canonicalExponents extends Set<infer T>
	? T
	: never;

const isCanonicalExponent = isOneOf(canonicalExponents);

function _exponent(fromName: rendering): exponent {
	return nameMap.get(fromName)!;
}

export function exponent(fromName: rendering): canonicalExponent {}

function _name(exponent: exponent): readonly rendering[] {
	return multiplierMap.get(exponent)!;
}

function subset(ks, o) {
	const o2 = {};
	for (const i in ks) o2[ks[i]] = o[ks[i]];

	return o2;
}

realisticSiMultipliers = subset(realisticSiMultipliers, siMultipliers);

const reverseSiMultipliers = invertMap(siMultipliers);

function scientificNotation(n) {
	let e = 0;
	let k = 0;
	while ((k = n / Math.pow(10, e)) > 1) e += 1;
	e -= 1;
	k *= 10;

	return [k, e];
}
