/**
 * @fileoverview like save state, but more sane.
 */

import * as Immutable from 'immutable';
import { v4 as v4uuid } from 'uuid';

import {
	ElementInstance,
	MutableElementInstance,
	NewElementInstance,
} from '#root/project/cultist/state/state.js';

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
