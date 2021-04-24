export const must: <T>(v: T | undefined, what?: string) => T = (
	v,
	what = '',
) => {
	if (v == undefined) throw new Error(`${must.name} ${what}`)
	return v
}
