import * as Aspects from '#//project/cultist/types';

function aspectsOf(item: Pick<Aspects.Element, 'id' | 'aspects'>) {
	return Object.entries({ ...item.aspects, [item.id]: 1 });
}

export { aspectsOf as of };

/**
 * Given a set of values that have aspects, returns the sum of those aspects.
 */
function sumAspects(
	i: Iterable<Pick<Aspects.Element, 'aspects' | 'id'> | undefined>
): Map<string, number> {
	const sum = new Map<string, number>();
	for (const it of i) {
		if (it === undefined) continue;
		sum.set(it.id, (sum.get(it.id) ?? 0) + 1);
		for (const [aspect, intensity] of aspectsOf(it)) {
			sum.set(aspect, (sum.get(aspect) ?? 0) + intensity);
		}
	}

	return sum;
}

export { sumAspects as sum };
