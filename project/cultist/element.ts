import * as state from 'monorepo/project/cultist/state/index.js';
import * as Iter from 'monorepo/ts/iter/index.js';

export function count(id: string, elements: state.State['elementStacks']) {
	return Iter.reduce(
		elements?.entries() ?? [],
		(p, [, el]) => p + (el.elementId !== id ? 0 : el.quantity ?? 1),
		0
	);
}
