/**
 * @fileoverview keys for localstorage.
 */

import { z } from 'zod';
import { stringToJSON } from 'zod_utilz';

import { Serde } from '#root/project/zemn.me/app/hook/useLocalStorage.js';
import { Issuer } from '#root/project/zemn.me/OAuth/clients.js';
import { LensGet, LensSet } from '#root/ts/lens.js';
import { and_then, Result, unwrap_or_else } from '#root/ts/result_types.js';
import { asyncSerdeNullable, serdeKey, serdeLens, serdeNullable } from '#root/ts/serde.js';
import { asyncStorageLens, StorageLens } from '#root/ts/storage.js';
import { resultFromZod } from '#root/ts/zod/util.js';


const _clientSecret = serdeLens(
	asyncStorageLens("0"),
	asyncSerdeNullable(serdeKey(
		{
			name: "HMAC",
			hash: { name: "SHA-256"}
		},
		["sign", "verify"]
	))
);


/**
 * Gets the user client secret from localStorage, or provisions a new one.
 */
export const clientSecret = async (s: Storage) => {
	const v = await LensGet(_clientSecret)(Promise.resolve(s));
	if (v !== null) return v;

	const randomBytes = crypto.getRandomValues(new Uint8Array(8));

	type Algorithm = {
		name: "HMAC",
		hash: { name: "SHA-256" }
	}

	const newKey = crypto.subtle.importKey(
		"raw",
		randomBytes,
		{
			name: "HMAC",
			hash: { name: "SHA-256" }
		},
		true,
		["sign", "verify"],
	) as Promise<(CryptoKey & { algorithm: Algorithm; usages: ("sign" | "verify")[]; })>;

	await LensSet(_clientSecret)(newKey, Promise.resolve(s))

	return newKey;
};


export const authCacheSchema = z.record(
	Issuer,
	z.strictObject({
		id_token: z.string()
	})
)

function zod<T extends z.ZodTypeAny>(schema: T): Serde<
	Result<z.TypeOf<T>, z.ZodError<string>>,
	string
> {
	return [
		v =>
			unwrap_or_else(
				and_then(v, v => JSON.stringify(v)),
				// why are you trying to serialize an error??
				e => { throw e }
			)
		,
		v => resultFromZod(stringToJSON().pipe(schema).safeParse(v))
	]
}


export const AuthorizationCache = serdeLens(
	StorageLens("1"),
	serdeNullable(zod(authCacheSchema))
);
