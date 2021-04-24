/**
 * @fileinfo process env stuff for SSR
 */

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			origin?: string
			protocol?: string
			routes?: readonly string[]
		}
	}
}

import { must } from './guard'

export const window = process.browser ? globalThis.window : undefined

export const origin = must(
	window?.location.origin ?? process.env.origin,
	'origin',
)

export const protocol = must(
	window?.location.protocol ?? process.env.protocol,
	'protocol',
)

export const routes = must(process.env.routes)

export interface Trie<T> extends ReadonlyMap<T, Trie<T>> {}
interface MutableTrie<T> extends Map<T, MutableTrie<T>> {}

const calculateRouteTrie = (routes: readonly string[]): Trie<string> => {
	let trie: MutableTrie<string> = new Map()

	const add = (
		t: MutableTrie<string>,
		...value: readonly string[]
	): MutableTrie<string> => {
		if (value.length == 0) return t

		const [base, ...tail] = value

		t.set(base, add(t.get(base) ?? new Map(), ...tail))

		return t
	}

	for (const route of routes) {
		add(trie, ...route.split('/'))
	}

	return trie
}

export const routeTrie = calculateRouteTrie(routes)
