import * as iter from './util'

test.each([
	[(i: number): i is 4 => i == 4, [1, 2, 3, 4, 4], [4, 4]],
	[(i: number): i is 4 => i == 4, [], []],
	[
		(i: string | undefined): i is string => i != undefined,
		['ok', undefined],
		['ok'],
	],
])('(%p) %p => %p', (f: any, i: any, o: any) => {
	expect([...iter.filter(i, f)]).toEqual(o)
})

test.each([
	[
		[1, 2, 3, 4],
		[1, 2, 3, 4],
	],
	[[], []],
])('%p => %p', (i, o) => {
	expect([...iter.uniq(i)]).toEqual(o)
})
