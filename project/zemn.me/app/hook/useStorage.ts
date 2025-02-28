/**
 * @fileoverview a synchronised Storage hook.
 */

import memoizee from "memoizee";

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

function setStorageItem(s: StorageControllerState, key: string, value: string) {
	s.storage.setItem(key, value);
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



function storageController(storage: Storage) {
	let state: StorageControllerState = {
		storage,
		listeners: new Map(),
	};


	return function(key: string) {
		return [
			/** onChange */
			(key: string, cb: (v: string | null) => void): [cancel: () => void] => {
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
			(value: string) => setStorageItem(
				state,
				key,
				value
			)

		]
	}
}

function localStorage() {
	return memoizee(() => storageController(window.localStorage));
}


