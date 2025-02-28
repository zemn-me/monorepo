/**
 * @fileoverview keys for localstorage.
 */

import b64 from 'base64-js';
import { useEffect } from 'react';

import { Lens } from '#root/ts/lens.js';

function useStorageEvent(cb: (e: StorageEvent) => void) {
	useEffect(
		() => {
			addEventListener("storage", cb);
			return () => removeEventListener("storage", cb)
		}
	)
}

type Serde<From, To> = [
	serialize: (f: From) => To,
	deserialize: (t: To) => From
]


const item =
(key: string) =>
	<T>(r: Serde<T, string>): Lens<Storage, T | null> => [
		storage => {
			const item = storage.getItem(key);
			if (item == null) return item;

			return r[1](item)
		},
		(value, storage) => {
			if (value === null) {
				return (storage.removeItem(key), storage);
			}

			storage.setItem(key, r[0](value))

			return storage
		}
	];

const serdeBytes: Serde<Uint8Array, string> = [
	u => b64.fromByteArray(u),
	u => b64.toByteArray(u)
];

const serdeString: Serde<string, string> = [
	u => u, u => u
]

export const ClientSecret = item("0")(serdeBytes);
export const IdToken = item("1")(serdeString);

export const LSet = <S, A>(
	lens: Lens<S, A>,
	storage: S,
	value: A
) => lens[1](value, storage);


export const LGet = <S, A>(
	lens: Lens<S, A>,
	storage: S,
) => lens[0](storage);




