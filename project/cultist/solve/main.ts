import * as cultist from 'cultist';
import * as fs from 'fs';

import * as dot from '#root/project/cultist/solve/dot.js';
import { map } from '#root/ts/iter/index.js';
import { walk } from '#root/ts/tree.js';
import { must, perhaps, select } from '#root/ts/util.js';

import { quoteIfNotIdentifier } from './util';

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

export function displayList(
	...elements: (Pick<cultist.Element, 'label' | 'id'> | undefined)[]
): string {
	return prettyList(
		elements.map(c => (c == undefined ? 'undefined' : caption(c)))
	);
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
		.map((l, i, a) => `(${i + 1}/${a.length}) ${l.toString() ?? l}`)
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
	return s.state ? shortBoardState(s.state, verb, element) : '(empty)';
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
	toDepth = Infinity,
	depth = 0
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
