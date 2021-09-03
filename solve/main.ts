import * as cultist from '//cultist';
import { quoteIfNotIdentifier } from './util';
import * as fs from 'fs';
import * as dot from '//solve/dot';
import { select, must, perhaps } from '//typescript/util';
import { duplicate, remove, filter, map } from '//typescript/iter';
import { isDefined } from '//typescript/guard';
import { walk } from '//typescript/tree';

interface BoardState {
	elements?: cultist.Element[];
	verbs?: cultist.Verb[];
	legacy?: cultist.Legacy;
}

export function textBoardState(b: BoardState) {
	return (b.elements ?? [])
		.concat(b.verbs ?? [])
		.map(e => e.label)
		.join(', ');
}


// NB: 'required' and 'requirements' imply different matching: a 'required' needs match *only one*
// and 'requirements' must ALL match


function* elementsValidForSlot(s: cultist.Slot, e: Iterable<cultist.Element>) {
	e = applyForbidden(s, e);
	e = applyRequirements(s, e);
	yield* e;
}

function* elementCombosForVerb(
	verb: cultist.Verb,
	slotted: (cultist.Element | undefined)[],
	elements: cultist.Element[]
): Generator<[cultist.Verb, (cultist.Element | undefined)[]]> {
	const slots: cultist.Slot[] = [
		...slotsOf(filter([verb, ...slotted], isDefined)),
	];

	yield [verb, slotted];

	let slotIndex = 0;
	for (const slot of slots) {
		slotIndex++;
		// cannot fill a slot which already has an element slotted in it
		if (slotted[slotIndex - 1] != undefined) continue;

		for (const element of elementsValidForSlot(slot, elements)) {
			const newSlotted = [...slotted];
			newSlotted[slotIndex - 1] = element;
			yield* elementCombosForVerb(verb, newSlotted, [
				...remove(elements, e => e === element),
			]);
		}
	}
}

function* elementCombos(verbs: cultist.Verb[], elements: cultist.Element[]) {
	for (const verb of verbs) yield* elementCombosForVerb(verb, [], elements);
}

function sumAspects(
	i: Iterable<Pick<cultist.Element, 'aspects' | 'id'> | undefined>
): Map<string, number> {
	const sum = new Map<string, number>();
	for (const it of i) {
		if (it === undefined) continue;
		sum.set(it.id, (sum.get(it.id) ?? 0) + 1);
		for (const [aspect, intensity] of aspectsOf(it)) {
			sum.set(aspect, (sum.get(aspect) ?? 0) + intensity);
		}
	}

	return sum;
}

export function displayList(
	...elements: (Pick<cultist.Element, 'label' | 'id'> | undefined)[]
): string {
	return prettyList(
		elements.map(c => (c == undefined ? 'undefined' : caption(c)))
	);
}

export function* availableRecipes(
	board: BoardState,
	recipes: Iterable<cultist.Recipe>,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
) {
	for (const [verb, elements] of elementCombos(
		board.verbs ?? [],
		board.elements ?? []
	)) {
		const sum = sumAspects(elements);
		RECIPE: for (const recipe of recipes) {
			if (!recipe.craftable) continue RECIPE;
			if (recipe.actionid !== undefined && verb.id !== recipe.actionid)
				continue;

			for (const [aspect, intensity] of Object.entries(
				recipe.requirements ?? {}
			)) {
				if ((sum.get(aspect) ?? 0) < intensity) continue RECIPE;
			}

			yield [recipe, elements] as [cultist.Recipe, cultist.Element[]];
		}
	}
}

export function displayRecipeCombo(
	recipe: cultist.Recipe,
	elements: cultist.Element[]
): string {
	return `${
		recipe.actionid !== undefined ? recipe.actionid + '/' : ''
	}${caption(recipe)}: ${prettyList(...elements.map(c => caption(c)))}`;
}

export function caption(
	r: Pick<cultist.Element, 'id' | 'label' | 'description'> | undefined,
	desc?: boolean
): string {
	if (r === undefined) return 'undefined';
	const showId = r.label == undefined || r.label.trim().length == 0;
	return (
		`${showId ? r.id : quoteIfNotIdentifier(r.label)}${
			!showId ? ` (${r.id})` : ''
		}` + (desc && r.description ? `: ${r.description}` : '')
	);
}

export function prettyList(...l: (string | { toString(): string })[]) {
	return `(${l.length}): ${l
		.map((l, i, a) => `(${i + 1}/${a.length}) ${l?.toString() ?? l}`)
		.sort()
		.join(';\n ')}`;
}

interface StateNode {
	createdBy?: cultist.Action;
	state?: BoardState;
	children?: StateNode[];
}

function stateNodeCaption(
	s: StateNode,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
) {
	return s?.state ? shortBoardState(s.state, verb, element) : '(empty)';
}

function* SelectLegacy(
	core: cultist.cultist,
	verbById: (id: string) => cultist.Verb,
	elementById: (id: string) => cultist.Element
): Generator<StateNode> {
	for (const legacy of core.legacies) {
		yield {
			createdBy: {
				kind: cultist.action.Kind.SelectLegacy,
				legacy: legacy,
			},
			state: initialBoardStateFromLegacy(legacy, verbById, elementById),
		};
	}
}

function applyRecipe(
	state: BoardState,
	recipe: [cultist.Recipe, cultist.Element[]],
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
): BoardState {
	let newElements: Iterable<cultist.Element> = state.elements ?? [];

	const [r, slots] = recipe;

	let slotid = 0;
	for (const slot of r.slots ?? []) {
		slotid++;
		if (slot.consumes) {
			newElements = remove(newElements, v => v == slots[slotid - 1]);
		}
	}

	return applyEffect(
		{
			...state,
			elements: [...newElements],
		},
		r.effects ?? {},
		verb,
		element
	);
}

function* derivePossibleNextSteps(
	s: BoardState,
	core: cultist.cultist,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
): Generator<StateNode> {
	if (s.legacy === undefined) {
		yield* SelectLegacy(core, verb, element);
	}

	for (const recipe of availableRecipes(s, core.recipes, verb, element)) {
		yield {
			createdBy: {
				kind: cultist.action.Kind.ExecuteRecipe,
				recipe: recipe,
				byPlayerAction: true,
			},
			state: applyRecipe(s, recipe, verb, element),
		};
	}
}

function completeTree(
	s: StateNode,
	core: cultist.cultist,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element,
	toDepth: number = Infinity,
	depth: number = 0
): StateNode {
	if (depth >= toDepth) {
		return s;
	}

	const children = [
		...derivePossibleNextSteps(s.state ?? {}, core, verb, element),
	];
	return {
		...s,
		children: children.map(child =>
			completeTree(child, core, verb, element, toDepth, depth + 1)
		),
	};
}

function shortBoardState(
	b: BoardState,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
): string {
	const m = new Map();
	for (const item of [...(b.elements ?? []), ...(b.verbs ?? [])]) {
		m.set(item.id, (m.get(item.id) ?? 0) + 1);
	}

	return prettyList(
		...[...m].map(
			([k, n]) =>
				`${caption(
					perhaps(
						() => verb(k),
						() => element(k)
					)
				)}: ${n}`
		)
	);
}

function actionCaption(action: cultist.Action): string {
	switch (action.kind) {
		case cultist.action.Kind.SelectLegacy:
			return `legacy: ${caption(action.legacy)}`;
		case cultist.action.Kind.ExecuteRecipe:
			return `recipe: ${caption(action.recipe[0])}`;
		default:
			throw new Error(
				`unimplemented ${cultist.action.Kind[action.kind]}`
			);
	}
}

function stateNodeToDot(
	s: StateNode,
	verb: (id: string) => cultist.Verb,
	element: (id: string) => cultist.Element
): dot.Digraph {
	return new dot.Digraph([
		...map(
			walk(s, n => n.children ?? []),
			([c, p]) =>
				new dot.Connection(
					stateNodeCaption(p, verb, element),
					'->',
					stateNodeCaption(c, verb, element),
					undefined,
					c.createdBy ? actionCaption(c.createdBy) : undefined
				)
		),
	]);
}

export const Main = async () => {
	const core: cultist.cultist = JSON.parse(
		(await fs.promises.readFile('gen/core_en.json')).toString('utf-8')
	);

	let element = must(
		select(core.elements, e => e.id),
		id => new Error(`Unknown element: ${id}`)
	);
	element = must(
		select(
			[
				...core.elements,
				{
					...element('auclair_b'),
					id: 'lever_LastFollower',
				},
			],
			e => e.id
		),
		id => new Error(`Unknown element: ${id}`)
	);

	const verb = must(
		select(core.verbs, v => v.id),
		id => new Error(`Unknown verb: ${id}`)
	);

	const tree = completeTree({}, core, verb, element, 4);

	console.log(stateNodeToDot(tree, verb, element).toDot());
};

export default Main;

if (require.main == module) {
	Main().catch(e => {
		console.error(e);

		// nb: not the same as nullish because we want null OR zero.
		process.exitCode = process.exitCode || 1;
	});
}
