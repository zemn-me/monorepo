import type { CoreContent } from '#root/project/cultist/content.js';
import type {
	Deck,
	Element,
	Recipe,
	Verb,
} from '#root/project/cultist/types.js';

export type AspectId = string;
export type CardId = string;
export type VerbId = string;
export type EndingId = string;

export type CardDefinition = Element;
export type VerbDefinition = Verb;
export type RecipeDefinition = Recipe;

export interface CardQuantity {
	readonly card: CardId;
	readonly count: number;
}

export interface Operation {
	readonly inputs: readonly CardQuantity[];
	readonly recipeId: string;
	readonly verb: VerbId;
	readonly startedAt: number;
	readonly remaining: number;
	readonly total: number;
}

export interface LogEntry {
	readonly at: number;
	readonly inputs?: readonly CardQuantity[];
	readonly outputs?: readonly CardQuantity[];
	readonly source?: LogSource;
	readonly title: string;
	readonly text: string;
	readonly kind: 'danger' | 'ending' | 'result' | 'season' | 'start';
}

export interface LogSource {
	readonly kind: 'alt' | 'linked';
	readonly recipeId: string;
	readonly title: string;
}

export interface GameState {
	readonly completed: Readonly<Record<string, number>>;
	readonly deckDraws: Readonly<Record<string, number>>;
	readonly ending?: EndingId;
	readonly inventory: Readonly<Record<CardId, number>>;
	readonly log: readonly LogEntry[];
	readonly operations: Readonly<Partial<Record<VerbId, Operation>>>;
	readonly time: number;
	readonly unlockedVerbs: Readonly<Record<VerbId, true>>;
}

function activeOperationEntries(
	operations: GameState['operations']
): [VerbId, Operation][] {
	return Object.entries(operations).flatMap(([verb, operation]) =>
		operation === undefined ? [] : [[verb, operation]]
	);
}

function activeOperations(operations: GameState['operations']): Operation[] {
	return activeOperationEntries(operations).map(([, operation]) => operation);
}

export interface RequirementStatus {
	readonly aspect: AspectId;
	readonly count: number;
	readonly forbidden: boolean;
	readonly have: number;
	readonly missing: number;
}

export interface RecipeStatus {
	readonly available: boolean;
	readonly blockedReason?: string;
	readonly recipe: RecipeDefinition;
	readonly requirements: readonly RequirementStatus[];
}

export interface GameData {
	readonly core: CoreContent;
	readonly decks: ReadonlyMap<string, Deck>;
	readonly elements: ReadonlyMap<CardId, CardDefinition>;
	readonly endings: ReadonlyMap<string, { readonly label?: string }>;
	readonly recipes: ReadonlyMap<string, RecipeDefinition>;
	readonly verbs: ReadonlyMap<VerbId, VerbDefinition>;
}

export function indexCore(core: CoreContent): GameData {
	return {
		core,
		decks: new Map(core.decks.map(deck => [deck.id, deck])),
		elements: new Map(core.elements.map(element => [element.id, element])),
		endings: new Map(
			core.endings
				.filter(
					(ending): ending is { readonly id: string; readonly label?: string } =>
						typeof ending === 'object' &&
						ending !== null &&
						'id' in ending &&
						typeof ending.id === 'string'
				)
				.map(ending => [ending.id, ending])
		),
		recipes: new Map(core.recipes.map(definition => [definition.id, definition])),
		verbs: new Map(core.verbs.map(verb => [verb.id, verb])),
	};
}

function numericEntries(
	record: Readonly<Record<string, number | string>> | undefined
): readonly [string, number][] {
	return Object.entries(record ?? {}).flatMap(([key, value]) =>
		typeof value === 'number' ? [[key, value] as const] : []
	);
}

function plainText(text: string | undefined): string {
	return (text ?? '.').replace(/<[^>]*>/g, '');
}

function labelForAspect(data: GameData, aspect: string): string {
	return data.elements.get(aspect)?.label ?? aspect;
}

export function cardLabel(data: GameData, id: CardId): string {
	return data.elements.get(id)?.label ?? id;
}

export function recipe(data: GameData, id: string): RecipeDefinition {
	const found = data.recipes.get(id);
	if (found === undefined) throw new Error(`Unknown recipe: ${id}`);
	return found;
}

export function verb(data: GameData, id: VerbId): VerbDefinition {
	const found = data.verbs.get(id);
	if (found === undefined) throw new Error(`Unknown verb: ${id}`);
	return found;
}

export function endingLabel(data: GameData, id: EndingId): string {
	return data.endings.get(id)?.label ?? id;
}

function appendLog(state: GameState, entry: Omit<LogEntry, 'at'>): GameState {
	return {
		...state,
		log: [...state.log, { ...entry, at: state.time }].slice(-48),
	};
}

function cardQuantities(
	data: GameData,
	counts: ReadonlyMap<CardId, number>
): readonly CardQuantity[] {
	const ordered = new Set(data.core.elements.map(element => element.id));
	for (const card of counts.keys()) ordered.add(card);

	return [...ordered]
		.map(card => ({ card, count: counts.get(card) ?? 0 }))
		.filter(({ count }) => count > 0);
}

function addQuantity(
	counts: Map<CardId, number>,
	card: CardId,
	count: number
) {
	if (count <= 0) return;
	counts.set(card, (counts.get(card) ?? 0) + count);
}

function aspectValue(element: CardDefinition | undefined, aspect: AspectId) {
	if (element === undefined) return 0;
	return (element.id === aspect ? 1 : 0) + (element.aspects?.[aspect] ?? 0);
}

function inventoryAspectsFor(
	data: GameData,
	inventory: Readonly<Record<CardId, number>>
): ReadonlyMap<AspectId, number> {
	const aspects = new Map<AspectId, number>();

	for (const [card, count] of Object.entries(inventory)) {
		if (count <= 0) continue;
		const definition = data.elements.get(card);
		aspects.set(card, (aspects.get(card) ?? 0) + count);
		for (const [aspect, value] of Object.entries(definition?.aspects ?? {})) {
			aspects.set(aspect, (aspects.get(aspect) ?? 0) + value * count);
		}
	}

	return aspects;
}

export function count(state: GameState, card: CardId): number {
	return state.inventory[card] ?? 0;
}

function availableInventory(state: GameState): Record<CardId, number> {
	const inventory = { ...state.inventory };

	for (const operation of activeOperations(state.operations)) {
		for (const input of operation.inputs) {
			inventory[input.card] = Math.max(
				0,
				(inventory[input.card] ?? 0) - input.count
			);
		}
	}

	return inventory;
}

export function visibleInventory(
	data: GameData,
	state: GameState
): readonly [CardDefinition, number][] {
	const visible = new Set(data.core.elements.map(element => element.id));
	for (const card of Object.keys(state.inventory)) visible.add(card);

	return [...visible].flatMap(card => {
		const amount = count(state, card);
		const definition = data.elements.get(card);
		if (amount <= 0 || definition === undefined || definition.isHidden === true) {
			return [];
		}
		return [[definition, amount] as const];
	});
}

export function cardAspects(
	data: GameData,
	card: CardId
): ReadonlyMap<AspectId, number> {
	const definition = data.elements.get(card);
	return new Map(Object.entries(definition?.aspects ?? {}));
}

export function inventoryAspects(
	data: GameData,
	state: Pick<GameState, 'inventory'>
): ReadonlyMap<AspectId, number> {
	return inventoryAspectsFor(data, state.inventory);
}

function requirementStatuses(
	data: GameData,
	state: GameState,
	definition: RecipeDefinition
): readonly RequirementStatus[] {
	const aspects = inventoryAspectsFor(data, availableInventory(state));

	return numericEntries(definition.requirements).map(([aspect, rawCount]) => {
		const forbidden = rawCount < 0;
		const needed = Math.abs(rawCount);
		const have = aspects.get(aspect) ?? 0;
		const missing = forbidden
			? Math.max(0, have - needed + 1)
			: Math.max(0, needed - have);

		return { aspect, count: needed, forbidden, have, missing };
	});
}

function recipeIsVisible(definition: RecipeDefinition): boolean {
	return definition.craftable === true && definition.hintonly !== true;
}

export function statusForRecipe(
	data: GameData,
	state: GameState,
	definition: RecipeDefinition
): RecipeStatus {
	const requirements = requirementStatuses(data, state, definition);
	const missing = requirements.filter(requirement => requirement.missing > 0);
	const verbBusy =
		definition.actionid !== undefined &&
		state.operations[definition.actionid] !== undefined;

	if (state.ending !== undefined) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: 'This history is complete.',
		};
	}

	if (verbBusy) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: `${verb(data, definition.actionid!).label} is already occupied.`,
		};
	}

	if (
		definition.maxexecutions !== undefined &&
		(state.completed[definition.id] ?? 0) >= definition.maxexecutions
	) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: 'Already completed.',
		};
	}

	if (missing.length > 0) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: missing
				.map(requirement =>
					requirement.forbidden
						? `No ${labelForAspect(data, requirement.aspect)}`
						: `${labelForAspect(data, requirement.aspect)} ${requirement.have}/${requirement.count}`
				)
				.join(', '),
		};
	}

	return { recipe: definition, requirements, available: true };
}

export function recipeStatuses(
	data: GameData,
	state: GameState
): readonly RecipeStatus[] {
	return data.core.recipes
		.filter(recipeIsVisible)
		.map(definition => statusForRecipe(data, state, definition));
}

export function availableRecipesForVerb(
	data: GameData,
	state: GameState,
	verb: VerbId
): readonly RecipeStatus[] {
	return recipeStatuses(data, state).filter(
		status => status.recipe.actionid === verb && status.available
	);
}

function matchingCards(
	data: GameData,
	inventory: Readonly<Record<CardId, number>>,
	aspect: AspectId,
	needed: number
): readonly CardQuantity[] {
	const matches = new Map<CardId, number>();
	let remaining = needed;
	const exact = inventory[aspect] ?? 0;

	if (exact > 0) {
		const count = Math.min(exact, remaining);
		addQuantity(matches, aspect, count);
		remaining -= count;
	}

	for (const [card, count] of Object.entries(inventory)) {
		if (remaining <= 0 || card === aspect || count <= 0) continue;
		const value = aspectValue(data.elements.get(card), aspect);
		if (value <= 0) continue;
		const used = Math.min(count, Math.ceil(remaining / value));
		addQuantity(matches, card, used);
		remaining -= used * value;
	}

	return cardQuantities(data, matches);
}

function recipeInputs(
	data: GameData,
	state: GameState,
	definition: RecipeDefinition
): readonly CardQuantity[] {
	const inputs = new Map<CardId, number>();
	const inventory = availableInventory(state);

	for (const [aspect, amount] of numericEntries(definition.requirements)) {
		if (amount <= 0) continue;
		for (const match of matchingCards(data, inventory, aspect, amount)) {
			inputs.set(match.card, Math.max(inputs.get(match.card) ?? 0, match.count));
		}
	}

	for (const [card, amount] of numericEntries(definition.effects)) {
		if (amount >= 0) continue;
		const consumed = Math.min(Math.abs(amount), inventory[card] ?? 0);
		if (consumed <= 0) continue;
		inputs.set(card, Math.max(inputs.get(card) ?? 0, consumed));
	}

	return cardQuantities(data, inputs);
}

function changeInventory(
	data: GameData,
	inventory: Readonly<Record<CardId, number>>,
	effects: readonly [CardId, number][]
): Record<CardId, number> {
	const next = { ...inventory };

	for (const [card, amount] of effects) {
		const current = next[card] ?? 0;
		const definition = data.elements.get(card);
		const uniqueLimit = definition?.unique === true ? 1 : Infinity;
		next[card] = Math.max(0, Math.min(uniqueLimit, current + amount));
	}

	return next;
}

function drawFromDeck(
	data: GameData,
	state: GameState,
	deckId: string
): readonly [GameState, CardId | undefined] {
	const deck = data.decks.get(deckId);
	const spec = deck?.spec instanceof Array ? deck.spec : [];
	const draw = state.deckDraws[deckId] ?? 0;
	const card =
		spec[draw] ??
		(deck?.resetonexhaustion === true && spec.length > 0
			? spec[draw % spec.length]
			: deck?.defaultcard);

	return [
		{
			...state,
			deckDraws: {
				...state.deckDraws,
				[deckId]: draw + 1,
			},
		},
		card,
	];
}

function applyDeckEffects(
	data: GameData,
	state: GameState,
	definition: RecipeDefinition
): GameState {
	let next = state;
	const drawn: [CardId, number][] = [];

	for (const [deckId, amount] of numericEntries(definition.deckeffects)) {
		for (let i = 0; i < amount; i++) {
			let card: CardId | undefined;
			[next, card] = drawFromDeck(data, next, deckId);
			if (card !== undefined) drawn.push([card, 1]);
		}
	}

	if (drawn.length === 0) return next;
	return {
		...next,
		inventory: changeInventory(data, next.inventory, drawn),
	};
}

function producedCards(
	data: GameData,
	before: Readonly<Record<CardId, number>>,
	after: Readonly<Record<CardId, number>>
): readonly CardQuantity[] {
	const produced = new Map<CardId, number>();
	const cards = new Set([...Object.keys(before), ...Object.keys(after)]);

	for (const card of cards) {
		const amount = (after[card] ?? 0) - (before[card] ?? 0);
		if (amount > 0) produced.set(card, amount);
	}

	return cardQuantities(data, produced);
}

function shouldApplyReference(reference: RecipeDefinition): boolean {
	return reference.chance === undefined || reference.chance >= 100;
}

function applyRecipeResult(
	data: GameData,
	state: GameState,
	definition: RecipeDefinition,
	seen: ReadonlySet<string>,
	source?: LogSource
): GameState {
	const before = state.inventory;
	let next: GameState = {
		...state,
		inventory: changeInventory(data, state.inventory, numericEntries(definition.effects)),
		completed: {
			...state.completed,
			[definition.id]: (state.completed[definition.id] ?? 0) + 1,
		},
		unlockedVerbs:
			definition.actionid === undefined
				? state.unlockedVerbs
				: { ...state.unlockedVerbs, [definition.actionid]: true },
	};

	next = applyDeckEffects(data, next, definition);

	next = appendLog(next, {
		outputs: producedCards(data, before, next.inventory),
		...(source === undefined ? {} : { source }),
		title: definition.label ?? definition.id,
		text: plainText(definition.description),
		kind: definition.ending === undefined ? 'result' : 'ending',
	});

	if (definition.ending !== undefined) {
		return { ...next, ending: definition.ending, operations: {} };
	}

	const nextSeen = new Set(seen);
	nextSeen.add(definition.id);

	for (const { kind, reference } of [
		...(definition.alt ?? []).map(reference => ({
			kind: 'alt' as const,
			reference,
		})),
		...(definition.linked ?? []).map(reference => ({
			kind: 'linked' as const,
			reference,
		})),
	]) {
		if (!shouldApplyReference(reference) || nextSeen.has(reference.id)) continue;
		const linked = data.recipes.get(reference.id);
		if (linked === undefined) continue;
		const status = statusForRecipe(data, next, linked);
		if (
			!status.available &&
			Object.keys(linked.requirements ?? {}).length > 0
		) {
			continue;
		}
		next = applyRecipeResult(data, next, linked, nextSeen, {
			kind,
			recipeId: definition.id,
			title: definition.label ?? definition.id,
		});
	}

	return next;
}

export function startRecipe(
	data: GameData,
	state: GameState,
	recipeId: string
): GameState {
	const definition = recipe(data, recipeId);
	const status = statusForRecipe(data, state, definition);
	if (!status.available) {
		throw new Error(
			`${definition.label ?? definition.id} is not available: ${
				status.blockedReason ?? 'unknown reason'
			}`
		);
	}

	if (definition.actionid === undefined) {
		throw new Error(`${definition.label ?? definition.id} has no action.`);
	}

	const inputs = recipeInputs(data, state, definition);
	const duration = definition.warmup ?? 0;
	const withOperation: GameState = {
		...state,
		operations: {
			...state.operations,
			[definition.actionid]: {
				inputs,
				recipeId,
				verb: definition.actionid,
				startedAt: state.time,
				remaining: duration,
				total: duration,
			},
		},
		unlockedVerbs: { ...state.unlockedVerbs, [definition.actionid]: true },
	};

	return appendLog(withOperation, {
		inputs,
		title: definition.label ?? definition.id,
		text: plainText(definition.startdescription),
		kind: 'start',
	});
}

function completeOperation(
	data: GameData,
	state: GameState,
	operation: Operation
): GameState {
	const definition = recipe(data, operation.recipeId);
	const operations = { ...state.operations };
	delete operations[operation.verb];

	return applyRecipeResult(
		data,
		{
			...state,
			operations,
		},
		definition,
		new Set()
	);
}

export function advanceTime(
	data: GameData,
	state: GameState,
	seconds: number
): GameState {
	if (seconds < 0) throw new Error('Cannot move time backwards.');
	if (state.ending !== undefined || seconds === 0) return state;

	const operations: GameState['operations'] = Object.fromEntries(
		activeOperationEntries(state.operations).map(([verb, operation]) => [
			verb,
			{
				...operation,
				remaining: Math.max(0, operation.remaining - seconds),
			},
		])
	);

	let next: GameState = {
		...state,
		time: state.time + seconds,
		operations,
	};

	const completed = activeOperations(next.operations)
		.filter(operation => operation.remaining <= 0)
		.sort((a, b) => a.startedAt + a.total - (b.startedAt + b.total));

	for (const operation of completed) {
		next = completeOperation(data, next, operation);
	}

	return next;
}

export function nextCompletionIn(state: GameState): number | undefined {
	const remaining = activeOperations(state.operations).map(
		operation => operation.remaining
	);

	if (remaining.length === 0) return undefined;
	return Math.min(...remaining);
}

export function advanceToNextCompletion(
	data: GameData,
	state: GameState
): GameState {
	const seconds = nextCompletionIn(state);
	if (seconds === undefined) return state;
	return advanceTime(data, state, seconds);
}

export function playRecipeToCompletion(
	data: GameData,
	state: GameState,
	recipeId: string
): GameState {
	return advanceToNextCompletion(data, startRecipe(data, state, recipeId));
}

export function newGame(data: GameData, legacyId = 'aspirant'): GameState {
	const legacy =
		data.core.legacies.find(definition => definition.id === legacyId) ??
		data.core.legacies[0];
	if (legacy === undefined) throw new Error('No legacy content loaded.');

	const inventory = changeInventory(data, {}, numericEntries(legacy.effects));
	const startingVerb =
		legacy.startingverbid === undefined
			? {}
			: { [legacy.startingverbid]: true as const };

	return {
		inventory,
		operations: {},
		completed: {},
		deckDraws: {},
		time: 0,
		unlockedVerbs: startingVerb,
		log: [
			{
				at: 0,
				title: legacy.label ?? legacy.id,
				text: plainText(legacy.startdescription ?? legacy.description),
				kind: 'result',
			},
		],
	};
}

export function visibleVerbIds(
	data: GameData,
	state: GameState,
	statuses: readonly RecipeStatus[]
): readonly VerbId[] {
	const visible = new Set<VerbId>(Object.keys(state.unlockedVerbs));

	for (const status of statuses) {
		if (status.recipe.actionid === undefined) continue;
		if (
			status.available ||
			status.requirements.some(
				requirement => !requirement.forbidden && requirement.have > 0
			)
		) {
			visible.add(status.recipe.actionid);
		}
	}

	for (const operation of activeOperations(state.operations)) {
		visible.add(operation.verb);
	}

	return data.core.verbs
		.map(definition => definition.id)
		.filter(id => visible.has(id));
}

export function cardTone(
	card: CardDefinition
): 'ability' | 'danger' | 'lore' | 'material' | 'society' {
	if (card.isAspect === true || card.aspects?.lore !== undefined) return 'lore';
	if (
		card.aspects?.dread !== undefined ||
		card.aspects?.fascination !== undefined ||
		card.aspects?.notoriety !== undefined ||
		card.aspects?.evidence !== undefined
	) {
		return 'danger';
	}
	if (card.aspects?.ability !== undefined) return 'ability';
	if (
		card.aspects?.follower !== undefined ||
		card.aspects?.society !== undefined ||
		card.aspects?.cult !== undefined
	) {
		return 'society';
	}
	return 'material';
}
