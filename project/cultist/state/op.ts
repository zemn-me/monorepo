/**
 * @fileoverview like save state, but more sane.
 */

import Immutable from 'immutable';
import {
	ElementInstance,
	MutableElementInstance,
	NewElementInstance,
} from 'monorepo/project/cultist/state/state.js';
import { v4 as v4uuid } from 'uuid';

const uuid = { v4: v4uuid };

export function createElement(
	id: string,
	tmpl: Partial<Omit<MutableElementInstance, 'id'>> = {}
): ElementInstance {
	return NewElementInstance({
		elementId: id,
		quantity: 1,
		...tmpl,
	});
}

export function addElements(
	el: Iterable<ElementInstance>,
	stacks?: Immutable.Map<string, ElementInstance>
): Immutable.Map<string, ElementInstance> {
	if (stacks === undefined) stacks = Immutable.Map<string, ElementInstance>();

	return stacks.withMutations(stacks => {
		for (const element of el) {
			stacks.set(uuid.v4(), element);
		}

		return stacks;
	});
}
