/**
 * @fileoverview keys for localstorage.
 */

import b64 from 'base64-js';
import { useEffect } from 'react';
import { z } from 'zod';
import { stringToJSON } from 'zod_utilz';

import { Serde, useLocalStorageItem } from '#root/project/zemn.me/app/hook/useLocalStorage.js';
import { Issuer } from '#root/project/zemn.me/OAuth/clients.js';
import { Ok, Result } from '#root/ts/result_types.js';
import { asyncSerdeNullable, serdeIdentity, serdeKey, serdeLens, serdeNullable } from '#root/ts/serde.js';
import { asyncStorageLens, StorageLens } from '#root/ts/storage.js';
import { resultFromZod } from '#root/ts/zod/util.js';


export const clientSecret = serdeLens(
	asyncStorageLens("0"),
	asyncSerdeNullable(serdeKey(
		{
			name: "HMAC",
			hash: { name: "SHA-256"}
		},
		["sign", "verify"])
	)
);



export const IdToken = serdeLens(
	StorageLens("1"),
	serdeNullable(serdeIdentity<string>())
);

const authCacheSchema = z.record(
	Issuer,
	z.strictObject({
		id_token: z.string()
	})
)

function zod<T extends z.ZodTypeAny>(schema: T): Serde<
	Result<z.TypeOf<T>, z.ZodError<string>>,
	Result<string, unknown>
> {
	return [
		v => Ok(JSON.stringify(v)),
		v => resultFromZod(stringToJSON().pipe(schema).safeParse(v))
	]
}



export const AuthorizationCache = serdeLens(
	StorageLens("2"),
	// this needs some other higher-order serde helper.
	serdeNullable(zod(authCacheSchema))
);
