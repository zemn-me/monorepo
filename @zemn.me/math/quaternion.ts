export interface Quaternion<
	R extends number = number,
	I extends number = number,
	J extends number = number,
	K extends number = number,
> {
	r?: R
	i?: I
	j?: J
	k?: K
}

export function add(
	{ r: r1 = 0, i: i1 = 0, j: j1 = 0, k: k1 = 0 }: Quaternion,
	{ r: r2 = 0, i: i2 = 0, j: j2 = 0, k: k2 = 0 }: Quaternion,
): Quaternion {
	return { r: r1 + r2, i: i1 + i2, j: j1 + j2, k: k1 + k2 }
}

export function adds(...q: Quaternion[]): Quaternion {
	const [first, ...etc] = q
	let val = first
	for (const v of etc) val = add(val, v)
	return val
}

export function mul(
	{ r: r1 = 0, i: i1 = 0, j: j1 = 0, k: k1 = 0 }: Quaternion,
	{ r: r2 = 0, i: i2 = 0, j: j2 = 0, k: k2 = 0 }: Quaternion,
): Quaternion {
	const a1 = r1,
		a2 = r2,
		b1 = i1,
		b2 = i2,
		c1 = j1,
		c2 = j2,
		d1 = k1,
		d2 = k2

	return adds(
		{ r: a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2 },
		{ i: a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2 },
		{ j: a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2 },
		{ k: a1 * d2 + b1 * c2 - c1 * b2 + d2 * a2 },
	)
}
