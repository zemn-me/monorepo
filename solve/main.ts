import * as cultist from './types';
import immutable from 'immutable';
import fs from 'fs';


type ElementIdCache = Map<string, cultist.Element>

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
}

enum ActionKind {
    PassTime
}

interface PassTime { kind: ActionKind.PassTime, seconds: number }

export function initialBoardStateFromLegacy(l: cultist.Legacy, verbById: (id: string) => cultist.Verb, elementById: (id: string) => cultist.Element): BoardState {
    let board: BoardState = { verbs: l.startingverbid !== undefined? [verbById(l.startingverbid)]: undefined };
    if (l.effects !== undefined) board = applyEffect(board, l.effects, verbById, elementById);
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

interface Arrangement {
    verb: cultist.Verb
    slotted: cultist.Element[]
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

function* applyForbidden({forbidden: s}: Pick<cultist.Slot, 'forbidden'>, e: Iterable<cultist.Element>) {
    const aspects: string[] = Object.entries(s??{}).map(([disallowed]) => disallowed);
    const notAllowed = new Set(aspects);

    OUTER:
    for (const element of e) {
        for (const [aspect] of Object.entries(element.aspects??{})) {
            if (notAllowed.has(aspect)) continue OUTER;
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

function* applyRequirements({requirements: s}: Pick<cultist.Slot, 'requirements'>, e: Iterable<cultist.Element>) {
    const aspectRequirement = Object.entries(s??{});

    const requiredAspects = new Map(aspectRequirement.filter(
        ([aName, intensity]) => intensity > 0
    ));

    const disallowedAspects = new Map(aspectRequirement.filter(
        ([aName, intensity]) => intensity < 0
    ));

    for (const element of e) {
        const elAspects = Object.entries(element.aspects??{});

        if (elAspects.some(([aspect]) => disallowedAspects.has(aspect))) {
            continue;
        }

        const concernedAspects = filter(elAspects, ([aspect]) => requiredAspects.has(aspect));

        if (some(concernedAspects, ([aspect, intensity]) => requiredAspects.get(aspect)! < intensity)) continue;

        yield element;
    }
}

function* elementsValidForSlot(s: cultist.Slot, e: Iterable<cultist.Element>) {
    e = applyForbidden(s, e);
    e = applyRequirements(s, e);
    yield *e;
}

function* elementCombosForVerb(verb: cultist.Verb, slotted: (cultist.Element|undefined)[], elements: cultist.Element[]):
    Generator<[cultist.Verb, (cultist.Element|undefined)[]]> {
    yield [verb, slotted];
    const slots: cultist.Slot[] = [...slotsOf(filter([verb, ...slotted], isDefined))];
    let slotIndex = 0;
    for (const slot of slots) {
        if (slotted[slotIndex] != undefined) continue;
        for (const element of elementsValidForSlot(slot, elements)) {
            const newSlotted = [...slotted];
            newSlotted[slotIndex] = element;
            yield *elementCombosForVerb(verb, newSlotted, [...remove(elements, e => e === element)]);
        }
        slotIndex++;
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
        for (const [aspect, intensity] of Object.entries(it.aspects??{})) {
            sum.set(aspect, (sum.get(aspect)??0) + intensity);
        }
    }

    return sum;
}

export function* availableRecipes(board: BoardState, recipes: Iterable<cultist.Recipe>, verb: (id: string) => cultist.Verb, element: (id: string) => cultist.Element) {
    let rs = filterRecipesByAvailableActions(recipes, board.verbs ?? []);

    for (const [ verb, elements ] of elementCombos(board.verbs ?? [], board.elements ?? [])) {
        const sum = sumAspects(elements)
        RECIPE:
        for (const recipe of recipes) {
            if (!recipe.craftable) continue RECIPE;
            if (recipe.actionid !== undefined && verb.id !== recipe.actionid) continue;

            for (const [aspect, intensity] of Object.entries(recipe.requirements??{})) {
                if ((sum.get(aspect) ?? 0) < intensity) continue RECIPE;
            }


            yield recipe
        }
    }
}

export function caption(r: Pick<cultist.Element, 'id' | 'label' | 'description'> | undefined, desc?: boolean): string {
    if (r === undefined) return "undefined";
    return `${r.label !== undefined && r.label.trim().length !== 0? r.label: r.id}`
        + (desc && r.description? `: ${r.description}`: "");
}

export function prettyList(...l: (string | { toString(): string })[] ) {
    return `(${l.length}): ${l.map((l, i, a) => `(${i+1}/${a.length}) ${l?.toString() ?? l}`).join("; ")}`
}

export const Main = async () => {
    const core: cultist.Core = JSON.parse((await fs.promises.readFile('gen/core_en.json')).toString('utf-8'));
    const elementById = must(select(core.elements, e => e.id), id => new Error(`Unknown element: ${id}`));
    const verbById = must(select(core.verbs, v => v.id), id => new Error(`Unknown verb: ${id}`));
    for (const legacy of core.legacies) {
        const board = initialBoardStateFromLegacy(legacy, verbById, elementById);

        console.log("Legacy: ", caption(legacy))


        console.log(" - Board: ", prettyList(...[...board.elements ?? [], ...board.verbs ?? []].map(e => caption(e))));
        [...elementCombos(board.verbs??[], board.elements??[])].forEach(([v, e]) => console.log(" - Combo:", caption(v), prettyList(e.map(x => caption(x)))));
        console.log(" - Recipes:", prettyList(...[...availableRecipes(board, core.recipes, verbById, elementById)].map(e => caption(e))));

    }
}

export default Main;


if (require.main == module) {
    Main().catch(e => {
        console.error(e);

        // nb: not the same as nullish because we want null OR zero.
        process.exitCode = process.exitCode || 1;
    });
}