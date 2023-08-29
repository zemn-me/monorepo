import * as Slots from 'monorepo/project/cultist/slots.js';
import * as cultist from 'monorepo/project/cultist/types.js';
import { isDefined } from 'monorepo/ts/guard.js';
import { filter, remove } from 'monorepo/ts/iter/index.js';

function* elementCombosForVerb(
	verb: cultist.Verb,
	slotted: (cultist.Element | undefined)[],
	elements: cultist.Element[]
): Generator<[cultist.Verb, (cultist.Element | undefined)[]]> {
	const slots: cultist.Slot[] = [
		...Slots.of(filter([verb, ...slotted], isDefined)),
	];

	yield [verb, slotted];

	let slotIndex = 0;
	for (const slot of slots) {
		slotIndex++;
		// cannot fill a slot which already has an element slotted in it
		if (slotted[slotIndex - 1] != undefined) continue;

		for (const element of Slots.elementsValid(slot, elements)) {
			const newSlotted = [...slotted];
			newSlotted[slotIndex - 1] = element;
			yield* elementCombosForVerb(verb, newSlotted, [
				...remove(elements, e => e === element),
			]);
		}
	}
}

function* elementCombos(
	verbs: Iterable<cultist.Verb>,
	elements: Iterable<cultist.Element>
) {
	for (const verb of verbs)
		yield* elementCombosForVerb(verb, [], [...elements]);
}

export { elementCombos as combos };
