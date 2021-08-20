import * as cultist from './types';
import { quoteIfNotIdentifier } from './util';
import immutable from 'immutable';
import fs from 'fs';
import * as dot from './dot';


export function select<T, S>(values: T[], f: (arg0: T) => S) {
    const cache = new Map<S, T>();
    for (const v of values) cache.set(f(v), v);

    return (v: S): T | undefined => cache.get(v)
}

export function must<I extends unknown[], O>(f: (...a: I) => O | undefined, e?: (...a: I) => Error): (...a: I) => O {
    return (...a: I) => {
        const r = f(...a);
        if (r === undefined) {
            throw (e? e(...a): new Error('must'));
        }

        return r;
    }
}

function* duplicate<T>(i: Iterable<[T, number]>) {
    for (const [v, n] of i) {
        for (let i = 0; i < n; i++) {
            yield {...v}; // copy
        }
    }
}

export function elementsByEffects(effects: Record<string, number>, elementById: (id: string) => cultist.Element): cultist.Element[] {
    const elementsAndCounts = Object.entries(effects).map(([id, count]): [ cultist.Element, number ] => [elementById(id), count]);

    const rets =  [...duplicate(elementsAndCounts)];
    return rets;
}

interface BoardState {
    elements?: cultist.Element[]
    verbs?: cultist.Verb[]
    legacy?: cultist.Legacy
}

enum ActionKind { PassTime, ExecuteRecipe, SelectLegacy }

interface SelectLegacy { kind: ActionKind.SelectLegacy, legacy: cultist.Legacy }
interface PassTime { kind: ActionKind.PassTime, seconds: number }
interface ExecuteRecipe { kind: ActionKind.ExecuteRecipe, recipe: [cultist.Recipe, cultist.Element[]], byPlayerAction: boolean }
type Action = SelectLegacy | PassTime | ExecuteRecipe


export function initialBoardStateFromLegacy(l: cultist.Legacy, verbById: (id: string) => cultist.Verb, elementById: (id: string) => cultist.Element): BoardState {
    let board: BoardState = { verbs: l.startingverbid !== undefined? [verbById(l.startingverbid)]: undefined };
    if (l.effects !== undefined) board = applyEffect(board, l.effects, verbById, elementById);
    board.legacy = l;
    return board;
}

export function textBoardState(b: BoardState) {
    return (b.elements??[]).concat(b.verbs??[]).map(e => e.label).join(", ")
}

export function textLegacy(l: cultist.Legacy, verbByid: (id: string) => cultist.Verb, elementById: (id: string) => cultist.Element) {
    return `${l.label}: ${textBoardState(initialBoardStateFromLegacy(l, verbByid, elementById))}`
}


export function* remove<T>(l: Iterable<T>, s: (v: T) => boolean, n: number = Infinity) {
    for (const val of l) {
        if (n < 1 || !s(val)) yield val;
        
        n--;
    }
}

export function applyCounts(elements: cultist.Element[], effect: Record<string, number>, V: (id: string) => cultist.Verb, E: (id: string) => cultist.Element) {
    for (const [on, value] of Object.entries(effect)) {
        elements = value > 0?
            [...elements, ...duplicate([[E(on), value]]) ]:
            [...remove(elements, el => el.id == on, value)];
    }

    return elements;
}

export function applyEffect(boardState: BoardState, effect: cultist.Effect, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element) {
    const newState = {...boardState};
    for (const [on, value] of Object.entries(effect)) {
        if (typeof value == "string") throw new Error(`Don't know how to apply special effect: ${value}`);

        newState.elements = applyCounts(newState.elements ?? [], { [on]: value }, verb, element);
    }

    return newState;
}

export function* filterRecipesByAvailableActions(recipes: Iterable<cultist.Recipe>, actions: cultist.Verb[]) {
    for (const recipe of recipes) {
        if (recipe.actionid !== undefined && !actions.some(v => v.id === recipe.actionid)) continue;
        yield recipe;
    }
}

function* slotsOf(i: Iterable<{ slot?: cultist.Slot} | { slots?: cultist.Slot[]}>) {
    for (const it of i) {
        if ('slot' in it) {
            if (it.slot !== undefined) yield it.slot;
        }

        if ('slots' in it) {
            yield *(it.slots ?? []);
        }
    }
}

function* applyForbidden(slot: Pick<cultist.Slot, 'forbidden' | 'label' | 'id'>, e: Iterable<cultist.Element>) {
    const aspects: string[] = Object.entries(slot.forbidden??{})
        .map(([disallowed]) => disallowed);

    const notAllowed = new Set(aspects);

    OUTER:
    for (const element of e) {
        for (const [aspect] of aspectsOf(element)) {
            if (notAllowed.has(aspect)) {
                 continue OUTER;
            }
        }
        yield element;
    }
}

function filter<T, O extends T>(i: Iterable<T>, f: (i: T) => i is O): Generator<O>
function filter<T>(i: Iterable<T>, f: (i: T) => boolean): Generator<T>

function* filter<T>(i: Iterable<T>, f: (i: T) => boolean) {
    for (const it of i) {
        if (f(it)) yield it;
    }
}

function isDefined<T>(i: T | undefined): i is T {
    return i !== undefined
}

function some<T>(i: Iterable<T>, f: (i: T) => boolean) {
    for (const it of i) {
        if (f(it)) return true;
    }

    return false;
}

function aspectsOf(item: Pick<cultist.Element, 'id' | 'aspects'>) {
    return Object.entries({ ...item.aspects, [item.id]: 1 })
}


// NB: 'required' and 'requirements' imply different matching: a 'required' needs match *only one*
// and 'requirements' must ALL match
function matchesRequired(item: Pick<cultist.Slot, 'id' | 'description' | 'label' | 'required'>) {
    const spec = Object.entries(item.required??{});
    const disallowed = new Set();
    const required = new Map();


    for (const [aspect, intensity] of spec) {
        if (intensity < 0) {
            disallowed.add(aspect);
            continue;
        }

        // can probably clobber? but I don't think the game ever does this
        required.set(aspect, intensity);
    }

    return (compareTo: Pick<cultist.Element, 'aspects' | 'description' | 'label' | 'id'>) => {
        let hasRequired = false;
        for (const [aspect, intensity] of aspectsOf(compareTo)) {
            // I don't think anything can have negative intensity, but it doesnt hurt to check
            if (disallowed.has(aspect) && intensity > 0) {
                 return false;
            }


            if (hasRequired || (required.has(aspect) && intensity >= required.get(aspect))) {
                hasRequired = true
            }
        }

        return hasRequired;
    }

}

function* applyRequirements(slot: cultist.Slot, e: Iterable<cultist.Element>) {
    const matches = matchesRequired(slot);

    for (const element of e) {
        if (matches(element)) yield element;
    }
}

function* elementsValidForSlot(s: cultist.Slot, e: Iterable<cultist.Element>) {
    e = applyForbidden(s, e);
    e = applyRequirements(s, e);
    yield *e;
}

function* elementCombosForVerb(verb: cultist.Verb, slotted: (cultist.Element|undefined)[], elements: cultist.Element[]):
    Generator<[cultist.Verb, (cultist.Element|undefined)[]]> {

    const slots: cultist.Slot[] = [...slotsOf(filter([verb, ...slotted], isDefined))];


    yield [verb, slotted];


    let slotIndex = 0;
    for (const slot of slots) {
        slotIndex++;
        // cannot fill a slot which already has an element slotted in it
        if (slotted[slotIndex-1] != undefined) continue;

        for (const element of elementsValidForSlot(slot, elements)) {
            const newSlotted = [...slotted];
            newSlotted[slotIndex-1] = element;
            yield *elementCombosForVerb(verb, newSlotted, [...remove(elements, e => e === element)]);
        }
    }
}

function* elementCombos(verbs: cultist.Verb[], elements: cultist.Element[]) {
    for (const verb of verbs) yield *elementCombosForVerb(verb, [], elements);
}

function sumAspects(i: Iterable<Pick<cultist.Element, 'aspects'| 'id'> | undefined>): Map<string, number> {
    const sum = new Map<string, number>();
    for (const it of i) {
        if (it === undefined) continue;
        sum.set(it.id, (sum.get(it.id)??0) + 1);
        for (const [aspect, intensity] of aspectsOf(it)) {
            sum.set(aspect, (sum.get(aspect)??0) + intensity);
        }
    }

    return sum;
}

export function displayList(...elements: (Pick<cultist.Element, 'label' | 'id'> | undefined)[]): string {
    return prettyList(elements.map(c => c == undefined? 'undefined' :caption(c)));
}

export function* availableRecipes(board: BoardState, recipes: Iterable<cultist.Recipe>, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element) {
    for (const [ verb, elements ] of elementCombos(board.verbs ?? [], board.elements ?? [])) {
        const sum = sumAspects(elements)
        RECIPE:
        for (const recipe of recipes) {
            if (!recipe.craftable) continue RECIPE;
            if (recipe.actionid !== undefined && verb.id !== recipe.actionid) continue;

            for (const [aspect, intensity] of Object.entries(recipe.requirements??{})) {
                if ((sum.get(aspect) ?? 0) < intensity) continue RECIPE;
                
            }


            yield [ recipe, elements ] as [ cultist.Recipe, cultist.Element[]]
        }
    }
}

export function displayRecipeCombo(recipe: cultist.Recipe, elements: cultist.Element[]): string {
    return `${recipe.actionid !== undefined? recipe.actionid +"/": ""}${caption(recipe)}: ${prettyList(...elements.map(c => caption(c)))}`
}

export function caption(r: Pick<cultist.Element, 'id' | 'label' | 'description'> | undefined, desc?: boolean): string {
    if (r === undefined) return "undefined";
    const showId = r.label == undefined || r.label.trim().length == 0;
    return `${showId?r.id:quoteIfNotIdentifier(r.label)}${!showId?` (${r.id})`:""}`
        + (desc && r.description? `: ${r.description}`: "");
}

export function prettyList(...l: (string | { toString(): string })[] ) {
    return `(${l.length}): ${l.map((l, i, a) => `(${i+1}/${a.length}) ${l?.toString() ?? l}`).sort().join(";\n ")}`
}


interface StateNode {
    createdBy?: Action
    state?: BoardState,
    children?: StateNode[]
}

function stateNodeCaption(s: StateNode, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element) {
    return s?.state?shortBoardState(s.state, verb, element):"(empty)"
}


function* SelectLegacy(core: cultist.Core, verbById: (id: string) => cultist.Verb, elementById: (id: string) => cultist.Element): Generator<StateNode> {
    for (const legacy of core.legacies) {
        yield ({
            createdBy: { kind: ActionKind.SelectLegacy, legacy: legacy },
            state: initialBoardStateFromLegacy(legacy, verbById, elementById)
        });
    }
}

function applyRecipe(state: BoardState, recipe: [cultist.Recipe, cultist.Element[]], verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element): BoardState {
    let newElements: Iterable<cultist.Element> = state.elements??[];

    const [ r, slots ] = recipe;

    let slotid = 0;
    for (const slot of r.slots??[]) {
        slotid++;
        if (slot.consumes) {
            newElements = remove(newElements, v => v == slots[slotid-1]);
        }
    }

    
    return applyEffect({
        ...state,
        elements: [...newElements]
    }, r.effects ?? {}, verb, element)
}

function* derivePossibleNextSteps(s: BoardState, core: cultist.Core, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element): Generator<StateNode> {
    if (s.legacy === undefined) {
        yield *SelectLegacy(core, verb, element);
    }


    for (const recipe of availableRecipes(s, core.recipes, verb, element)) {
        yield ({
            createdBy: { kind: ActionKind.ExecuteRecipe, recipe: recipe, byPlayerAction: true },
            state: applyRecipe(s, recipe, verb, element)
        });
    }
}

function completeTree(s: StateNode, core: cultist.Core, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element, toDepth: number = Infinity, depth: number = 0): StateNode {
    if (depth >= toDepth) {
        return s;
    };

    const children = [...derivePossibleNextSteps(s.state??{}, core, verb, element)];
    return {
        ...s,
        children: children.map(child => completeTree(child, core, verb, element, toDepth, depth+1))
    }
}

function* walk<T>(root: T, children: (v: T) => T[], path: T[] = []): Generator<T[]> {
    yield [root, ...path];
    for (const child of children(root)) {
        yield *walk(child, children, [root, ...path])
    }
}

function* map<I, O>(i: Iterable<I>, f: (i: I) => O): Iterable<O> {
    for (const it of i) yield f(it);
}

function perhaps<T>(...fs: (() => T)[]): T {
    let errors = [];
    for (const f of fs) {
        try {return f()}
        catch(e){ errors.push(e) }
    }

    throw errors;
}

function shortBoardState(b: BoardState, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element): string {
    const m = new Map();
    for (const item of [...b.elements??[], ...b.verbs??[]]) {
        m.set(item.id, (m.get(item.id)??0) +1)
    }

    return prettyList(...[...m].map(([k, n]) => `${
        caption(perhaps(
            () => verb(k),
            () => element(k)
        ))
    }: ${n}`))
}

function actionCaption(action: Action): string {
    switch (action.kind) {
    case ActionKind.SelectLegacy:
        return `legacy: ${caption(action.legacy)}`
    case ActionKind.ExecuteRecipe:
        return `recipe: ${caption(action.recipe[0])}`
    default:
        throw new Error(`unimplemented ${ActionKind[action.kind]}`);
    }
}

function stateNodeToDot(s: StateNode, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element): dot.Digraph {
    return new dot.Digraph(
        [...map(walk(s, n => n.children ?? []), ([c, p]) => new dot.Connection(
            stateNodeCaption(p, verb, element),
            "->",
            stateNodeCaption(c, verb, element),
            undefined,
            c.createdBy?actionCaption(c.createdBy):undefined
        ))]
    )
}

export const Main = async () => {
    const core: cultist.Core = JSON.parse((await fs.promises.readFile('gen/core_en.json')).toString('utf-8'));

    let element = must(select(core.elements, e => e.id), id => new Error(`Unknown element: ${id}`));
    element = must(select([
        ...core.elements,
        {
            ...element("auclair_b"),
            id: "lever_LastFollower",
        },
    ], e => e.id), id => new Error(`Unknown element: ${id}`));

    const verb = must(select(core.verbs, v => v.id), id => new Error(`Unknown verb: ${id}`));

    const tree = completeTree({}, core, verb, element, 4);

    console.log(stateNodeToDot(tree, verb, element).toDot());
}

export default Main;


if (require.main == module) {
    Main().catch(e => {
        console.error(e);

        // nb: not the same as nullish because we want null OR zero.
        process.exitCode = process.exitCode || 1;
    });
}