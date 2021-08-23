/**
 * @fileoverview like save state, but more sane.
 */

import * as save from '//cultist/save';

export interface State {
	elementStacks?: {
		[name: string]: ElementInstance;
	};

	decks?: {
		[name: string]: Deck;
	};

	metainfo?: {
		VERSIONNUMBER?: string;
	};

	characterDetails?: CharacterDetails;

	situations?: {
		[name: string]: Situation;
	};
}

function dictMap<V, O>(
	o: { [key: string]: V },
	f: (v: V) => O
): { [key: string]: O } {
	return Object.assign(
		{},
		...Object.entries(o).map(([n, el]) => ({ [n]: f(el) }))
	);
}

export function serializeState(s: State): save.State {
	return {
		...s,
		elementStacks: optionalChain(dictMap)(
			s.elementStacks,
			serializeElementInstance
		),
		decks: optionalChain(dictMap)(s.decks, serializeDeck),
		situations: optionalChain(dictMap)(s.situations, SerializeSituation),
	};
}

export interface ElementInstance {
	/** Time in seconds */
	lifetimeRemaining?: number;
	lastTablePosX?: number;
	lastTablePosY?: number;
	/** Will be destroyed when recipe completes */
	markedForConsumption?: boolean;
	elementId?: string;
	quantity?: number;
}

function optionalChain<T, O, P extends unknown[]>(f: (v: T, ...a: P) => O) {
	return (v: T | undefined, ...a: P) => {
		if (v === undefined) return undefined;
		return f(v, ...a);
	};
}

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

export interface Deck {
	eliminatedCards: string[];
	cards: string[];
}

function serializeDeck({ eliminatedCards, cards }: Deck): save.Deck {
	return {
		eliminatedCards,
		...Object.assign(
			{},
			...cards.map(([card, index]) => ({ [index]: card }))
		),
	};
}

export interface Levers {
	lastheadquarters?: string;
	lastfollower?: string;
	lastsignificantpainting?: string;
	lastpersonkilled?: string;
	lastcharactername?: string;
	lastcult?: string;
	lasttool?: string;
	lastbook?: string;
	lastdesire?: string;
}

export interface CharacterDetails {
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
}

export interface Situation {
	situationStoredElements?: Record<string, ElementInstance>;
	verbId?: string;
	ongoingSlotElements?: Record<string, ElementInstance>;
	situationWindowY?: string;
	title?: string;
	timeRemaining?: string;
	recipeId?: string | null;
	situationWindowX?: string;
	state?: string;
	situationOutputNotes?: Record<
		string,
		{
			title?: string;
		}
	>;
	situationWindowOpen?: string;
	completioncount?: string;
}

function SerializeSituation(s: Situation): save.Situation {
	return {
		...s,
		situationStoredElements: optionalChain(dictMap)(
			s.situationStoredElements,
			serializeElementInstance
		),

		ongoingSlotElements: optionalChain(dictMap)(
			s.ongoingSlotElements,
			serializeElementInstance
		),
	};
}
