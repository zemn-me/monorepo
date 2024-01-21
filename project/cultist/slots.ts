import * as Aspects from '#//project/cultist/aspects';
import * as cultist from '#//project/cultist/types';

export function* of(
	i: Iterable<{ slot?: cultist.Slot } | { slots?: cultist.Slot[] }>
) {
	for (const it of i) {
		if ('slot' in it) {
			if (it.slot !== undefined) yield it.slot;
		}

		if ('slots' in it) {
			yield* it.slots ?? [];
		}
	}
}

function* forbidding(
	slot: Pick<cultist.Slot, 'forbidden' | 'label' | 'id'>,
	e: Iterable<cultist.Element>
) {
	const aspects: string[] = Object.entries(slot.forbidden ?? {}).map(
		([disallowed]) => disallowed
	);

	const notAllowed = new Set(aspects);

	OUTER: for (const element of e) {
		for (const [aspect] of Aspects.of(element)) {
			if (notAllowed.has(aspect)) {
				continue OUTER;
			}
		}
		yield element;
	}
}

/**
 * Given a Slot and an iterable of elements, returns a new iterable
 * that only yields elements which could sit in that slot.
 */
function* applyRequirements(slot: cultist.Slot, e: Iterable<cultist.Element>) {
	const matches = matchesElement(slot);

	for (const element of e) {
		if (matches(element)) yield element;
	}
}

/**
 * Returns a function which returns true if the element could match this slot
 */
function matchesElement(
	item: Pick<cultist.Slot, 'id' | 'description' | 'label' | 'required'>
) {
	const spec = Object.entries(item.required ?? {});
	const disallowed = new Set();
	const required = new Map();

	for (const [aspect, intensity] of spec) {
		if (intensity < 0) {
			disallowed.add(aspect);
			continue;
		}

		// can probably clobber? but I don't think the game ever does this
		required.set(aspect, intensity);
	}

	return (
		compareTo: Pick<
			cultist.Element,
			'aspects' | 'description' | 'label' | 'id'
		>
	) => {
		let hasRequired = false;
		for (const [aspect, intensity] of Aspects.of(compareTo)) {
			// I don't think anything can have negative intensity, but it doesnt hurt to check
			if (disallowed.has(aspect) && intensity > 0) {
				return false;
			}

			if (
				hasRequired ||
				(required.has(aspect) && intensity >= required.get(aspect))
			) {
				hasRequired = true;
			}
		}

		return hasRequired;
	};
}

/**
 * Given a slot and a set of elements, return elements that can be put in that slot
 */
function* elementsValidForSlot(s: cultist.Slot, e: Iterable<cultist.Element>) {
	e = forbidding(s, e);
	e = applyRequirements(s, e);
	yield* e;
}

export { elementsValidForSlot as elementsValid };
