import b64 from 'base64-js';

import { Lens, LensGet, LensSet } from '#root/ts/lens.js';
import { None, Option, Some, unwrap_or } from '#root/ts/option/types.js';

export type Serialize<I, O> = (v: I) => O

/**
 * A Serde is both halves of a {@link Serialize} and deserialize pair.
 *
 * For a given {@link Serde}<I, O>, the first item of the tuple
 * is a function that converts {@link I} to {@link O}, while the
 * second item is the opposite.
 */
export type Serde<I, O> = [
	serialize: Serialize<I, O>,
	deseralize: Serialize<O, I>
]

/**
 * Return the Serialize half of an {@link Serde}.
 */
export function Serialize<I, O>(s: Serde<I, O>) {
	return s[0]
}

/**
 * Return the deserialize half of an {@link Serde}.
 */
export function Deserialize<I, O>(s: Serde<I, O>) {
	return s[1]
}

export function serdePipe<I, O, O2>(
	s1: Serde<I, O>,
	s2: Serde<O, O2>
): Serde<I, O2> {
	return [
		v => Serialize(s2)(Serialize(s1)(v)),
		v => Deserialize(s1)(Deserialize(s2)(v))
	]
}

export function serdeIdentity<T>(): Serde<T, T> {
	return [
		/** serialize */ (v: T) => v,
		/** deserialize */ (v: T) => v
	]
}


type Algorithm = AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm

// the types for this suck

export function serdeKey<const A extends Algorithm, U extends CryptoKey["usages"]>(
	a: Algorithm,
	usages: U
): Serde<Promise<CryptoKey & { algorithm: A, usages: U }>, Promise<string>> {
	return [
		async k => JSON.stringify(await crypto.subtle.exportKey("jwk", await k)),
		async s => crypto.subtle.importKey("jwk", JSON.parse(await s), a, true, usages) as Promise<CryptoKey & { algorithm: A, usages: U }>
	]
}

export function asyncSerdeNullable<I, O>(s: Serde<Promise<I>, Promise<O>>): Serde<Promise<I | null>, Promise<O | null>> {
	return [
		/** serialize */ async v => {
			const vv = await v;
			return vv === null? null: Serialize(s)(Promise.resolve(vv))
		},
		/** deserialize */ async v => {
			const vv = await v;
			return vv === null? null: Deserialize(s)(Promise.resolve(vv))
		}
	]
}


export function serdeOptional<I, O>(s: Serde<I | null, O | null>): Serde<Option<I>, Option<O>> {
	return [
		/** serialize */ v => {
			const vv = Serialize(s)(unwrap_or(v, null));
			if (vv === null) return None;

			return Some(vv);
		},
		/** deserialize */ v => {
			const vv = Deserialize(s)(unwrap_or(v, null));
			if (vv === null) return None;

			return Some(vv);
		}
	]
}


export function serdeNullable<I, O>(s: Serde<I, O>): Serde<I | null, O | null> {
	return [
		/** serialize */ v => v === null ? null : Serialize(s)(v),
		/** deserialize */ v => v === null ? null: Deserialize(s)(v)
	]
}

export function serdePromise<I, O>(s: Serde<I, O>): Serde<
	Promise<I>,
	Promise<O>
	> {
	return [
		/** serialize */ async v => Serialize(s)(await v),
		/** deserialize */ async v => Deserialize(s)(await v)
	]
}


export const serdeb64ByteString: Serde<Uint8Array, string> = [
	u => b64.fromByteArray(u),
	u => b64.toByteArray(u)
];

/**
 * A {@link Lens} which allows getting / setting a {@link Needle} from a
 * {@link Haystack} can be turned into one that gets or sets a
 * {@link Deserialized} from an {@link Haystack}, if a {@link Serde} is
 * provided mapping two and from {@link Needle} and {@link Deserialized}.
 */
export function serdeLens<Haystack, Needle, Deserialized>(
        lens: Lens<Haystack, Needle>,
        serde: Serde<Deserialized, Needle>,
): Lens<Haystack, Deserialized> {
        return (f) => f(
                v => Deserialize(serde)(LensGet(lens)(v)),
                (needle, haystack) => LensSet(lens)(Serialize(serde)(needle), haystack),
        )
}

