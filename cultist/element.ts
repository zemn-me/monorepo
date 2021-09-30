import * as state from '//cultist/state';
import * as Iter from '//typescript/iter';

export function count(id: string, elements: state.State['elementStacks']) {
	return Iter.reduce(
		elements?.entries() ?? [],
		(p, [, el]) => p + (el.elementId !== id ? 0 : el.quantity ?? 1),
		0
	);
}
