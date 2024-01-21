import immutable from 'immutable';

import * as state from '#root/project/cultist/state/index.js';
import * as cultist from '#root/project/cultist/types.js';
import * as iter from '#root/ts/iter/index.js';

export enum Kind {
	PassTime = 0,
	ExecuteRecipe = 1,
	SelectLegacy = 2,
}

export interface SelectLegacy {
	kind: Kind.SelectLegacy;
	legacy: cultist.Legacy;
}

export interface PassTime {
	kind: Kind.PassTime;
	seconds: number;
}
export interface ExecuteRecipe {
	kind: Kind.ExecuteRecipe;
	recipe: [cultist.Recipe, cultist.Element[]];
	byPlayerAction: boolean;
}
export declare type Action = SelectLegacy | PassTime | ExecuteRecipe;

export function* decreaseQuantityBy(
	id: string,
	elements: Iterable<[string, state.ElementInstance]>,
	n: number
) {
	for (let i = 0; i < n; i++) {
		elements = decreaseQuantity(id, elements);
	}

	yield* elements;
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

function applyEffect(s: state.State, effect: cultist.Effect): state.State {
	return s.withMutations(s => {
		const ops = Object.entries(effect);

		const [add, remove] = iter.divide(
			ops,
			([, intensity]) => +intensity > 0
		);

		let elementStacks =
			s.elementStacks ?? immutable.Map<string, state.ElementInstance>();

		elementStacks = state.addElements(
			iter.map(
				iter.filterAssert(add, (v): asserts v is [string, number] => {
					if (typeof v[1] === 'string')
						throw new Error(
							`Don't know how to ${JSON.stringify(v)}`
						);
				}),

				([name, count]) =>
					state.createElement(name, { quantity: count })
			),
			elementStacks
		);

		let elementStacksIter = elementStacks.entries();

		for (const [name, quantity] of remove) {
			if (typeof quantity == 'string') throw new Error();
			elementStacksIter = decreaseQuantityBy(
				name,
				elementStacksIter,
				-quantity
			);
		}

		return s.set('elementStacks', immutable.Map([...elementStacksIter]));
	});
}

export { applyEffect as effect };

function applyLegacy(s: state.State, l: cultist.Legacy) {
	if (l.effects !== undefined) s = applyEffect(s, l.effects);
	return s;
}

export { applyLegacy as legacy };
