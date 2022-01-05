/**
 * @fileoverview like save state, but more sane.
 */

import Immutable from 'immutable';

interface MutableState {
	elementStacks?: Immutable.Map<string, ElementInstance>;

	decks?: Immutable.Map<string, Deck>;

	metainfo?: Immutable.RecordOf<{
		VERSIONNUMBER?: string;
	}>;

	characterDetails?: CharacterDetails;

	situations?: Immutable.Map<string, Situation>;
}

export type State = Immutable.RecordOf<MutableState>;

export const NewState = Immutable.Record<MutableState>({
	elementStacks: undefined,
	decks: undefined,
	metainfo: undefined,
	characterDetails: undefined,
	situations: undefined,
});

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

export type ElementInstance = Immutable.RecordOf<MutableElementInstance>;

export const NewElementInstance = Immutable.Record<MutableElementInstance>({
	lifetimeRemaining: undefined,
	lastTablePosX: undefined,
	lastTablePosY: undefined,
	markedForConsumption: undefined,
	elementId: undefined,
	quantity: undefined,
});

export type Boolean = boolean;
export type Number = number;

interface MutableDeck {
	eliminatedCards?: Immutable.List<string>;
	cards?: Immutable.List<string>;
}

export type Deck = Immutable.RecordOf<MutableDeck>;

export const NewDeck = Immutable.Record<MutableDeck>({
	eliminatedCards: undefined,
	cards: undefined,
});

export interface MutableLevers {
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

export type Levers = Immutable.RecordOf<MutableLevers>;

export const NewLevers = Immutable.Record<MutableLevers>({
	lastheadquarters: undefined,
	lastfollower: undefined,
	lastsignificantpainting: undefined,
	lastpersonkilled: undefined,
	lastcharactername: undefined,
	lastcult: undefined,
	lasttool: undefined,
	lastbook: undefined,
	lastdesire: undefined,
});

export interface MutableCharacterDetails {
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

export type CharacterDetails = Immutable.RecordOf<MutableCharacterDetails>;

export const NewCharacterDetails = Immutable.Record<MutableCharacterDetails>({
	name: undefined,
	profession: undefined,

	pastLevers: undefined,

	executions: undefined,

	futureLevers: undefined,

	activeLegacy: undefined,
});

export interface MutableSituation {
	situationStoredElements?: Immutable.Map<string, ElementInstance>;
	verbId?: string;
	ongoingSlotElements?: Immutable.Map<string, ElementInstance>;
	situationWindowY?: string;
	title?: string;
	timeRemaining?: string;
	recipeId?: string | null;
	situationWindowX?: string;
	state?: string;
	situationOutputNotes?: Immutable.Map<string, { title?: string }>;
	situationWindowOpen?: string;
	completioncount?: string;
}

export type Situation = Immutable.RecordOf<MutableSituation>;

export const NewSituation = Immutable.Record<MutableSituation>({
	situationStoredElements: undefined,
	verbId: undefined,
	ongoingSlotElements: undefined,
	situationWindowY: undefined,
	title: undefined,
	timeRemaining: undefined,
	recipeId: undefined,
	situationWindowX: undefined,
	state: undefined,
	situationOutputNotes: undefined,
	situationWindowOpen: undefined,
	completioncount: undefined,
});

export interface MutableSituationOutputNote {
	title?: string;
}

export type SituationOutputNote =
	Immutable.RecordOf<MutableSituationOutputNote>;

export const NewSituationOutputNote =
	Immutable.Record<MutableSituationOutputNote>({});

export interface MutableMetainfo {
	VERSIONNUMBER?: string;
}

export type MetaInfo = Immutable.RecordOf<MutableMetainfo>;

export const NewMetaInfo = Immutable.Record<MutableMetainfo>({});
