export interface ElementInstance {
	lifetimeRemaining?: string;
	lastTablePosX?: string;
	lastTablePosY?: string;
	markedForConsumption?: string;
	elementId?: string;
	quantity: string;
}

export interface SaveState {
	elementStacks?: Record<string, ElementInstance>;
	decks?: Record<string, Deck>;
	metainfo?: {
		VERSIONNUMBER?: string;
	};
	characterDetails?: CharacterDetails;
	situations?: Record<string, Situation>;
}

export interface Deck {
	eliminatedCards: string[];
	/**
	 * Series of numbers as quoted strings,
	 * weirdly, where the keys are card IDs.
	 */
	[key: string]: string | string[];
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
