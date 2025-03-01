/**
 * @fileoverview a synchronised Storage hook.
 */

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { is_some, None, Option, Some, unwrap_unchecked } from "#root/ts/option/types.js";

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


type Controller = (key: string) => [
	onChange: (
		cb: (v: string | null) => void,
	) => [cancel: () => void],

	get: () => string | null,

	set: (value: string | null) => void

]


function storageController(storage: Storage): Controller {
	let state: StorageControllerState = {
		storage,
		listeners: new Map(),
	};


	return function(key: string) {
		return [
			/** onChange */
			(cb: (v: string | null) => void): [cancel: () => void] => {
				state = addStorageKeyListener(
					state,
					key,
					cb
				);

				return [() => {
					state = removeStorageKeyListener(
						state,
						key,
						cb
					)
				}]
			},

			/** get */
			(): string | null => storage.getItem(key),

			/** set */
			(value: string | null) => setStorageItem(
				state,
				key,
				value
			)

		]
	}
}



const storageControllerContext =
	createContext<Option<Controller>>(None);

export interface LocalStorageControllerProps {
	readonly children?: ReactNode
}

export function LocalStorageController(props: LocalStorageControllerProps) {
	return <storageControllerContext.Provider
		value={Some(storageController(localStorage))}>
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

export const useLocalStorageItem =
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
	<T extends any>(key: string, reviver: Serde<T, string | null>) => (): UseLocalStorageItemReturnType<T> => {
		const mCtx = useContext(storageControllerContext);
		if (!is_some(mCtx)) {
			throw new Error("missing controller");
		}

		const [
			bindOnChange,
			get,
			set
		] = useMemo(() => unwrap_unchecked(
			mCtx
		)(key), [key]);


		const [val, setVal] = useState<T>(
			reviver[1](
				get()
			)
		);

		const onChange = useCallback(
			(v: string | null): void => {
				setVal(
					reviver[1](v)
				)
			}
		, [setVal, reviver[1]] )

		useEffect(() => {
			const [cancel] = bindOnChange(onChange);

			return cancel;
		}, [bindOnChange, onChange]);

		const pubSet = (v: T) =>
			void set(
				reviver[0](v)
			)

		return [
			val,
			pubSet
		]

	}
