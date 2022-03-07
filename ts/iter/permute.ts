import Immutable from 'immutable';

function* picks<T>(v: Immutable.Set<T>) {
	for (const val of v) {
		yield [val, v.remove(val)] as const;
	}
}

export function* permute<T>(v: Immutable.Set<T>) {
	for (const [val, etc] of picks(v)) {
		for (const v2 of etc) {
			yield [val, v2];
		}
	}
}
