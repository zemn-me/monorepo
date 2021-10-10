// ts proto generation seems bad outside
// the google spaceship so this'll have to do

export interface cultist {
	cultures: Culture[];
	decks: Deck[];
	elements: Element[];
	verbs: Verb[];
	/** @deprecated in-game typo */
	legcies: Legacy[];
	legacies: Legacy[];
	settings: Setting[];
	recipes: Recipe[];
	endings: unknown[];
}

export interface Culture {
	id: string;
	fontscript?: string;
	released?: boolean;
	endonym?: string;
	exonym?: string;
	uilabels?: unknown;
	boldallowed?: boolean;
}

export interface Deck {
	id: string;
	description?: string;
	label?: string;
	resetonexhaustion?: boolean;
	spec?: string[];
	draws?: number[];
	defaultcard?: string;
	comments?: string;
	drawmessages?: Record<string, string>;
}

export interface Element {
	id: string;
	isAspect?: boolean;
	isHidden?: boolean;
	label?: string;
	icon?: string;
	unique?: boolean;
	xtriggers?: {
		[key: string]: unknown;
	};
	description?: string;
	aspects?: { [elementId: string]: number };
	lifetime?: number;
	uniquenessgroup?: string;
	slots?: Slot[];
	decayTo?: string;
	comments?: string;
	resaturate?: boolean;
	lever?: string;
	noartneeded?: boolean;
	induces?: Induction[];
	verbicon?: string;
	inherits?: string;
}

export interface Induction {
	id: string;
	chance: number;
}

export interface Effect {
	[value: string]: number | string;
}

export interface Recipe {
	id: string;
	actionid?: string;
	aspects?: { [elementid: string]: number };
	requirements?: { [aspectid: string]: number };
	description?: string;
	label?: string;
	warmup?: number;
	craftable?: boolean;
	alt?: Recipe[];
	slots?: Slot[];
	startdescription?: string;
	comments?: string;
	mutations?: Mutation[];
	maxexecutions?: number;
	linked?: Recipe[];
	tablereqs?: { [aspect: string]: number };
	effects?: Effect;
	deckeffects?: { [aspect: string]: number | string };
	burnimage?: string;
	extantreqs?: { [aspect: string]: number | string };
	hintonly?: boolean;
	ending?: string;
	signalEndingFlavour?: string;
	purge?: { [aspect: string]: number | string };
	deleteverb?: { [aspect: string]: number | string };
	haltverb?: { [aspect: string]: number | string };
	chance?: number;
	additional?: boolean;
	expulsion?: Expulsion;
	challenges?: { [kind: string]: string };
	signalimportantloop?: boolean;
}

export interface Mutation {
	filter?: string;
	level?: number;
	mutate?: string;
	additive?: boolean;
}

export interface Expulsion {
	limit?: number;
	filter?: { [key: string]: number };
}

export interface Slot {
	id: string;
	label?: string;
	description?: string;
	required?: { [kind: string]: number };
	forbidden?: { [kind: string]: number };
	//requirements?: unknown //{[kind:string]: number}, -- I think this is just 'required'
	greedy?: boolean;
	actionid?: string;
	consumes?: boolean;
	noanim?: boolean;
}

export interface Verb {
	id: string;
	description?: string;
	slots?: Slot[];
	label?: string;
	slot?: Slot;
}

export interface Legacy {
	id: string;
	label?: string;
	fromending?: string;
	description?: string;
	startdescription?: string;
	effects?: Effect;
	image?: string;
	startingverbid?: string;
	newstart?: boolean;
	availableWithoutEndingMatch?: boolean;
	tablecoverimage?: string;
	excludesOnEnding?: string[];
	statusbarelements?: string[];
}

export interface Setting {
	id: string;
	tabid?: string;
	hint?: string;
	datatype?: string;
	minvalue?: number;
	maxvalue?: number;
	defaultvalue?: string;
	valuelabels?: Record<number, string>;
}

/*
let _core: Promise<Core> | undefined;



export const core: () => Promise<Core> = async () => {
	if (_core === undefined) _core = await fs.promises.readFile('core_en.json')
		.then(b => JSON.parse(b.toString('utf-8')));
	return _core!;
}

export default core;
*/
