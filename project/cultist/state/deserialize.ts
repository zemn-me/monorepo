/**
 * @fileoverview like save state, but more sane.
 */

import Immutable from 'immutable';
import * as Save from 'project/cultist/save';
import * as State from 'project/cultist/state/state';
import * as Iter from 'ts/iter';
import { maybe } from 'ts/util';

function intoMap<I, O>(
	v: { [key: string]: I },
	f: (v: I) => O
): Immutable.Map<string, O> {
	return Immutable.Map(Iter.dict.toEntries(v).map(([k, v]) => [k, f(v)]));
}

export function elements(
	s: Save.State['elementStacks'] | Save.Situation['situationStoredElements']
): Immutable.Map<string, State.ElementInstance> | undefined {
	return maybe(intoMap)(s, elementInstance);
}

export function state(s: Save.State): State.State {
	return State.NewState({
		...s,
		decks: maybe(intoMap)(s.decks, deck),
		elementStacks: elements(s.elementStacks),
		metainfo: metaInfo(s.metainfo),
		characterDetails: characterDetails(s.characterDetails),
		situations: maybe(intoMap)(s.situations, situation),
	});
}

function number(s: Save.Number_): State.Number {
	return parseInt(s);
}

export const boolean = (e: Save.Boolean_): State.Boolean => {
	switch (e.toLowerCase()) {
		case 'true':
			return true;
		case 'false':
			return false;
	}

	throw new Error(`Cannot parse as boolean: ${e}`);
};

export function elementInstance(
	e: Save.ElementInstance
): State.ElementInstance {
	return State.NewElementInstance({
		elementId: e.elementId,
		lifetimeRemaining: maybe(number)(e.lifetimeRemaining),
		lastTablePosX: maybe(number)(e.lastTablePosX),
		lastTablePosY: maybe(number)(e.lastTablePosY),
		markedForConsumption: maybe(boolean)(e.markedForConsumption),
		quantity: maybe(number)(e.quantity),
	});
}

export function deck(s: Save.Deck): State.Deck {
	const { eliminatedCards, ...otherCards } = s;
	const cardList = [];

	for (const [cardInd, card] of Object.entries(otherCards ?? {})) {
		if (card instanceof Array)
			throw new Error(
				`'${cardInd}' should be single card, not multiple ${card}`
			);
		cardList[+cardInd] = card;
	}

	return State.NewDeck({
		...s,
		eliminatedCards: Immutable.List(eliminatedCards),
		cards: Immutable.List(cardList),
	});
}

export function levers(l: Save.Levers): State.Levers {
	return State.NewLevers({ ...l });
}

export function characterDetails(
	d: Save.State['characterDetails']
): State.CharacterDetails {
	return State.NewCharacterDetails({
		...d,
		pastLevers: maybe(levers)(d?.pastLevers),
		futureLevers: maybe(levers)(d?.futureLevers),
	});
}

export function situation(s: Save.Situation): State.Situation {
	return State.NewSituation({
		...s,
		situationStoredElements: elements(s.situationStoredElements),
		ongoingSlotElements: elements(s.ongoingSlotElements),
		situationOutputNotes: maybe(intoMap)(
			s.situationOutputNotes,
			situationOutputNote
		),
	});
}

export function situationOutputNote(
	s: Save.SituationOutputNote
): State.SituationOutputNote {
	return State.NewSituationOutputNote({
		...s,
	});
}

export function metaInfo(m: Save.State['metainfo']): State.MetaInfo {
	return State.NewMetaInfo({
		...m,
	});
}
