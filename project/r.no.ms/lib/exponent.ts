import { filter, flatten, map } from 'ts/iter';

const data = [
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
] as const;

type data = typeof data;

export type exponent = number;
export type rendering = string;

const multiplierMap = new Map<exponent, readonly rendering[]>(data);
const nameMap = new Map<rendering, exponent>([
	...flatten(
		map(data, ([exponent, renderings]) =>
			renderings.map((rendering: string): [rendering, exponent] => [
				rendering,
				exponent,
			])
		)
	),
]);

function name(exponent: exponent): readonly rendering[] | undefined {
	return multiplierMap.get(exponent);
}

function exponent(name: string): exponent | undefined {
	return nameMap.get(name);
}

/**
 * Translates a number from decimal (1000) to exponent
 * (1E10) form.
 */
function exponentForm(n: number): [k: number, e: number] {
	let e = 0;
	let k = 0;
	while ((k = n / Math.pow(10, e)) > 1) e += 1;
	e -= 1;
	k *= 10;

	return [k, e];
}

/**
 * renderSi takes a number and an exponent
 * and renders it to standard 'si', form.
 *
 * 1000Ω could be rendered as 1E3Ω, which in turn,
 * could be 1kΩ in si units.
 */
export function siWithGivenExponent(n: number, exp: number) {
	const deltas = filter(
		map(data, ([v]) => -(-v - exp)),
		v => !(v < 0)
	);

	const closest = Math.min(...deltas);

	const siExp = -closest + exp;

	// if we didn't manage to find a power
	// that worked exactly, we need to add
	// the differece to the significant
	// figures.
	//
	// we do this by putting whatever exponent
	// difference back on n.
	n *= Math.pow(10, closest);

	const unit = name(siExp)![0] ?? '';

	return [Math.round(n), unit].join(unit.length > 2 ? ' ' : '');
}

/**
 * si takes a number and renders it into standard, 'si'
 * form, assuming that the maximum possible exponent is
 * most useful.
 */
export function si(n: number) {
	return siWithGivenExponent(...exponentForm(n));
}
