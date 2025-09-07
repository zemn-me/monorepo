/**
 * @fileoverview a synchronised Storage hook.
 */

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { Lens, LensGet, LensSet } from "#root/ts/lens.js";
import { and_then, None, Option, Some, unwrap_or } from "#root/ts/option/types.js";
import { asyncStorageLensKey } from "#root/ts/storage/storage.js";

interface StorageEventLike {
	key: string | null
	newValue: string | null
	storageArea: Storage | null
}

interface StorageControllerState {
	storage: Storage
	listeners: Map<string, Set<((newValue: string | null) => void)>>;
	boundEventListener?: (s: StorageEventLike) => void
}

function onStorageEvent(s: StorageControllerState) {
	return function (e: StorageEventLike): void {
		if (e.storageArea !== s.storage) return;
		// see: https://developer.mozilla.org/en-US/docs/Web/API/StorageEvent
		// key null when whole thing is cleared.
		if (e.key === null) throw new Error("unhandled");
		[...s.listeners.get(e.key) ?? []].map(
			f => f(e.newValue)
		)
	}
}

function setStorageItem(s: StorageControllerState, key: string, value: string | null) {
	if (value === null) {
		s.storage.removeItem(key);
	} else {
		s.storage.setItem(key, value);
	}
	if (!s.boundEventListener) return;
	s.boundEventListener(
		{
			key, newValue: value,
			storageArea: s.storage
		}
	)
}

function listenForStorageEvents(state: StorageControllerState): StorageControllerState {
	if (state.boundEventListener) throw new Error();
	const binding = onStorageEvent(state);
	window.addEventListener("storage", binding);
	state.boundEventListener = binding;
	return state;
}

function stopListeningForStorageEvents(state: StorageControllerState): StorageControllerState {
	if (!state.boundEventListener) throw new Error();
	window.removeEventListener("storage", state.boundEventListener);
	state.boundEventListener = undefined;
	return state;
}

function isListeningForStorageEvents(state: StorageControllerState): state is StorageControllerState & { boundEventListener: (e: StorageEvent) => void } {
	return state.boundEventListener !== undefined;
}

function addStorageKeyListener(state: StorageControllerState, key: string, callback: (newValue: string | null) => void): StorageControllerState {
	const s = state.listeners.get(key) ?? new Set();
	s.add(callback);

	state.listeners.set(key, s);

	if (!isListeningForStorageEvents(state)) state = listenForStorageEvents(
		state
	);

	return state;
}

function removeStorageKeyListener(state: StorageControllerState, key: string, callback: (newValue: string | null) => void) {
	const s = state.listeners.get(key);
	if (s === undefined) throw new Error();
	s.delete(callback);

	if (s.size === 0) {
		state.listeners.delete(key);
	} else {
		state.listeners.set(key, s);
	}

	if (state.listeners.size === 0) state = stopListeningForStorageEvents(state);

	return state;
}


interface Controller extends Storage {
	onChange: (key: string, cb: (v: string | null) => void) => (() => void),
}

/**
 * Returns an enhanced {@link Storage} that allows binding to an `onChange`
 * event. The event fires whenever a key changes within the storage, on this
 * page *or* another page.
 */
function storageController(storage: Storage): Controller {
	let state: StorageControllerState = {
		storage,
		listeners: new Map(),
	};

	return {
		removeItem(key) {
			setStorageItem(
				state,
				key,
				null
			)
		},
		key(index) {
			return storage.key(index)
		},
		onChange(key, cb) {
			state = addStorageKeyListener(
				state,
				key,
				cb
			)

			return () => {
				state = removeStorageKeyListener(
					state, key, cb
				)
			}
		},
		get length(): number {
			return storage.length;
		},
		clear() {
			return storage.clear()
		},
		getItem(key) {
			return storage.getItem(key)
		},
		setItem(key, value) {
			setStorageItem(
				state, key, value
			)
		}
	}
}



const storageControllerContext =
	createContext<Option<Controller>>(None);

export interface LocalStorageControllerProps {
	readonly children?: ReactNode
}

export function LocalStorageController(props: LocalStorageControllerProps) {
	const [storage, setStorage] = useState<Option<Storage>>(() => None);

	const controller = and_then(
		storage,
		s => storageController(s)
	)

	// localStorage will only be available once you hit the browser
	useEffect(
		() => {
			setStorage(() => Some(localStorage))
		}
	, [])

	return <storageControllerContext.Provider
		value={controller}>
		{props.children}
		</storageControllerContext.Provider>
}

export type Serde<From, To> = [
	serialize: (f: From) => To,
	deserialize: (t: To) => From
]

export type UseLocalStorageItemReturnType<T> = [
	get: T,
	set: (v: T) => void
]

export const useLocalStorageController =
	() => useContext(storageControllerContext);


export function useLocalStorageItem<T>(lens: Lens<Promise<Storage>, Promise<T>>) {
	const key = asyncStorageLensKey(lens);
	const controller = useLocalStorageController();
	const [value, setValue] = useState<Option<T>>(() => None);

	// effect: when the component is mounted, set the value
	// to the result of the lens.
	useEffect(
		() => {
			and_then(
				controller,
				c => LensGet(lens)(Promise.resolve(c))
					.then(v => setValue(() => Some(v)))
			)
		}
	, [controller]);

	// effect: when the component is mounted,
	// listen for changes to the key.
	// wait... how do we even know the key...
	//
	// im guessing i need to do some combinator
	// arcana to make this work but for now I guess
	// im just gonna copy the key.
	useEffect(
		() => unwrap_or(and_then(
				controller,
			c => void key.then(k =>

				c.onChange(
					k,
					() => {
						void LensGet(lens)(Promise.resolve(c)).then(
							v => setValue(Some(v))
						)
					}
				)

			)


			), () => { })
	, [ controller ]);




	return [value, LensSet(lens)] as const;
}
