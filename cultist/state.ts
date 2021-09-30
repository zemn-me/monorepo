/**
 * @fileoverview like save state, but more sane.
 */

import * as save from '//cultist/save';
import * as iter from '//typescript/iter';
import { optionalChain } from '//typescript/util';
import immutable from 'immutable';
import { v4 as v4uuid } from 'uuid';

const uuid = { v4: v4uuid };

type ImmutableRecord<V> = immutable.RecordOf<{
	[k: string]: V;
}>;

interface MutableState {
	elementStacks?: immutable.Map<string, ElementInstance>;

	decks?: immutable.RecordOf<{
		[name: string]: Deck;
	}>;

	metainfo?: immutable.RecordOf<{
		VERSIONNUMBER?: string;
	}>;

	characterDetails?: CharacterDetails;

	situations?: immutable.RecordOf<{
		[name: string]: Situation;
	}>;
}

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
	stacks?: immutable.Map<string, ElementInstance>
): immutable.Map<string, ElementInstance> {
	if (stacks === undefined) stacks = immutable.Map<string, ElementInstance>();

	return stacks.withMutations(stacks => {
		for (const element of el) {
			stacks.set(uuid.v4(), element);
		}

		return stacks;
	});
}

export type State = immutable.RecordOf<MutableState>;

export const NewState = immutable.Record<MutableState>({
	elementStacks: undefined,
	decks: undefined,
	metainfo: undefined,
	characterDetails: undefined,
	situations: undefined,
});

export function serializeState(s: State): save.State {
	return {
		...s,
		elementStacks: optionalChain(iter.dict.map)(
			optionalChain(iter.dict.fromEntries)(s.elementStacks?.entries()),
			serializeElementInstance
		),
		decks: optionalChain(iter.dict.map)(s.decks, serializeDeck),
		situations: optionalChain(iter.dict.map)(
			s.situations,
			SerializeSituation
		),
	};
}

export interface MutableElementInstance {
	/** Time in seconds */
	lifetimeRemaining?: number;
	lastTablePosX?: number;
	lastTablePosY?: number;
	/** Will be destroyed when recipe completes */
	markedForConsumption?: boolean;
	elementId?: string;
	quantity?: number;
}

export type ElementInstance = immutable.RecordOf<MutableElementInstance>;

export const NewElementInstance = immutable.Record<MutableElementInstance>({
	lifetimeRemaining: undefined,
	lastTablePosX: undefined,
	markedForConsumption: undefined,
	elementId: undefined,
	quantity: undefined,
});

export function serializeBoolean(b: boolean): string {
	return b ? 'True' : 'False';
}

export function serializeElementInstance(
	e: ElementInstance
): save.ElementInstance {
	return {
		...e,
		lifetimeRemaining: e.lifetimeRemaining?.toString(),
		lastTablePosX: e.lastTablePosX?.toString(),
		lastTablePosY: e.lastTablePosY?.toString(),
		markedForConsumption: optionalChain(serializeBoolean)(
			e.markedForConsumption
		),
		quantity: e.quantity?.toString(),
	};
}

export type Deck = immutable.RecordOf<{
	eliminatedCards: string[];
	cards: string[];
}>;

function serializeDeck({ eliminatedCards, cards }: Deck): save.Deck {
	return {
		eliminatedCards,
		...Object.assign(
			{},
			...cards.map(([card, index]) => ({ [index]: card }))
		),
	};
}

export type Levers = immutable.RecordOf<{
	lastheadquarters?: string;
	lastfollower?: string;
	lastsignificantpainting?: string;
	lastpersonkilled?: string;
	lastcharactername?: string;
	lastcult?: string;
	lasttool?: string;
	lastbook?: string;
	lastdesire?: string;
}>;

export type CharacterDetails = immutable.RecordOf<{
	name?: string;
	/**
	 * Just a label, not an ID.
	 */
	profession?: string;

	pastLevers?: Levers;

	executions?: {
		/**
		 * Not sure what this means yet,
		 * but it might be running recipes.
		 */
		[key: string]: string;
	};

	futureLevers?: Levers;

	activeLegacy?: string;
}>;

export type Situation = immutable.RecordOf<{
	situationStoredElements?: ImmutableRecord<ElementInstance>;
	verbId?: string;
	ongoingSlotElements?: ImmutableRecord<ElementInstance>;
	situationWindowY?: string;
	title?: string;
	timeRemaining?: string;
	recipeId?: string | null;
	situationWindowX?: string;
	state?: string;
	situationOutputNotes?: ImmutableRecord<
		immutable.RecordOf<{
			title?: string;
		}>
	>;
	situationWindowOpen?: string;
	completioncount?: string;
}>;

function SerializeSituation(s: Situation): save.Situation {
	return {
		...s,
		situationStoredElements: optionalChain(iter.dict.map)(
			s.situationStoredElements?.toJS() as any,
			serializeElementInstance
		),

		ongoingSlotElements: optionalChain(iter.dict.map)(
			s.ongoingSlotElements?.toJS() as any,
			serializeElementInstance
		),
		situationOutputNotes: s.situationOutputNotes?.toJS() as any,
	};
}
