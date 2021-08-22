/**
 * @fileoverview like save state, but more sane.
 */

import * as save from '//cultist/savestate';

export interface State {
	elementStacks?: {
		[name: string]: ElementInstance
	}

	decks?: {
		[name: string]: Deck
	}

	metainfo?: {
		VERSIONNUMBER?: string
	}

	characterDetails?: CharacterDetails,

	situations?: {
		[name: string]: Situation
	}
}

export interface ElementInstance {
	/** Time in seconds */
	lifetimeRemaining?: number
	lastTablePosX?: number
	lastTablePosY?: number
	/** Will be destroyed when recipe completes */
	markedForConsumption?: boolean
	elementId?: string
	quantity?: number
}
