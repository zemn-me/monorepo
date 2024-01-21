import * as state from '#root/project/cultist/state/index.js';
import * as Iter from '#root/ts/iter/index.js';

export function count(id: string, elements: state.State['elementStacks']) {
	return Iter.reduce(
		elements?.entries() ?? [],
		(p, [, el]) => p + (el.elementId !== id ? 0 : el.quantity ?? 1),
		0
	);
}
