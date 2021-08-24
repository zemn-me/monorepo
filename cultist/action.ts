import * as state from '//cultist/state';
import immutable from 'immutable';
import * as cultist from '//cultist/types';
import * as iter from '//typescript/iter';
import { must, isDefined } from '//typescript/guard';
import uuid from 'uuid';
import { elementsByEffects } from '../bazel-out/k8-fastbuild/bin/solve/main';
import { apply } from '../typescript/iter/dict';

export function createElement(
	id: string,
	tmpl: Partial<Omit<state.MutableElementInstance, 'id'>> = {}
): state.ElementInstance {
	return state.NewElementInstance({
		elementId: id,
		quantity: 1,
		...tmpl,
	});
}

export function* decreaseQuantity(
	id: string,
	elements: Iterable<[string, state.ElementInstance]>
): Iterable<[string, state.ElementInstance]> {
	let done = false;
	for (const [key, element] of elements) {
		if (done || element.elementId != id) {
			yield [key, element];
			continue;
		}

		if (element.quantity !== undefined && element.quantity > 1) {
			yield [key, element.set('quantity', element.quantity! - 1)];
		}

		// this removes an element

		done = true;
	}
}

export function applyEffect(
	s: state.State,
	effect: cultist.Effect
): state.State {
	return s.withMutations(s => {
		const ops = Object.entries(effect);

		const [add, remove] = iter.divide(
			ops,
			([n, intensity]) => intensity > 0
		);

		let elementStacks =
			s.elementStacks ?? immutable.Map<string, state.ElementInstance>();

		for (const [name, quantity] of add) {
			if (typeof quantity == 'string')
				throw new Error(
					`Don't know how to handle special effect ${quantity}`
				);
			elementStacks = elementStacks.set(
				uuid.v4(),
				createElement(name, { quantity })
			);
		}

		let elementStacksIter = elementStacks.entries();

		for (const [name, quantity] of remove) {
			if (typeof quantity == 'string') throw new Error();
			for (let i = 0; i < quantity; i++) {
				decreaseQuantity(name, elementStacksIter);
			}
		}

		s = s.set('elementStacks', immutable.Map([...elementStacksIter]));

		return s.set('elementStacks', elementStacks);
	});
}

export function applyLegacy(s: state.State, l: cultist.Legacy) {
	if (l.effects !== undefined) s = applyEffect(s, l.effects);
	return s;
}
