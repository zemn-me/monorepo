/**
 * @fileoverview keys for localstorage.
 */

import b64 from 'base64-js';
import { useEffect } from 'react';
import { z } from 'zod';
import { stringToJSON } from 'zod_utilz';

import { Serde, useLocalStorageItem } from '#root/project/zemn.me/app/hook/useLocalStorage.js';
import { Issuer } from '#root/project/zemn.me/OAuth/clients.js';
import { Lens } from '#root/ts/lens.js';
import { and_then, None, Option, Some, unwrap_or } from '#root/ts/option/types.js';
import { resultFromZod } from '#root/ts/zod/util.js';


const serdeBytes: Serde<Uint8Array, string> = [
	u => b64.fromByteArray(u),
	u => b64.toByteArray(u)
];

const serdeString: Serde<string, string> = [
	u => u, u => u
];

function maybe<I, O>(s: Serde<I, O>): Serde<Option<I>, O | null> {
	return [
		i => unwrap_or(and_then(i, v => s[0](v)), null),
		i => i === null? None: Some(s[1](i))
	]
}


export const ClientSecret = useLocalStorageItem("0", maybe(serdeBytes));
export const IdToken = useLocalStorageItem("1", maybe(serdeString));

const authCacheSchema = z.record(
	Issuer,
	z.strictObject({
		id_token: z.string()
	})
)

function zod<T extends z.ZodTypeAny>(schema: T): Serde<z.TypeOf<T>, string> {
	return [
		v => JSON.stringify(v),
		v => resultFromZod(stringToJSON().pipe(schema).safeParse(v))
	]
}




export const AuthorizationCache = useLocalStorageItem("2", maybe(zod(authCacheSchema)))
