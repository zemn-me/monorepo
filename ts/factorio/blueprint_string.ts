import b64 from 'base64-js';
import pako from 'pako';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';
import { safeParseJSON } from '#root/ts/json.js';
import { Ok } from '#root/ts/result.js';
import { Base64 } from '#root/ts/zod/util.js';

// The version byte is currently 0 (for all Factorio versions through 1.1)
const versionByte = '0';

export const BlueprintString = z
	.string()
	.refine(v => v[0] == versionByte, {
		message: `Factorio blueprint must start with version byte "${versionByte}".`
	})
	.transform(v => v.slice(1))
	.pipe(Base64)
	.transform((val, ctx) =>
		Ok(() => pako.inflate(val)).safely().unwrap_or_else(e => {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `invalid flate compression: ${e}`
			});

			return z.NEVER;
		})
	)
	.transform((val, ctx) =>
		safeParseJSON(
			new TextDecoder().decode(
				val
			)
		).unwrap_or_else(e => {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `invalid JSON: ${e}`,
				fatal: true,
			})
			return z.NEVER;
		})
	).pipe(BlueprintWrapper);

export type BlueprintString = z.TypeOf<typeof BlueprintString>;

export const MarshalBlueprintString = (blueprint: Blueprint): string =>
	MarshalBlueprintWrapperString({ blueprint: blueprint });

export const MarshalBlueprintBookString = (book: BlueprintBook): string =>
	MarshalBlueprintWrapperString({ blueprint_book: book });

export const MarshalBlueprintWrapperString = (
	blueprint: BlueprintWrapper
): string =>
	versionByte +
	b64.fromByteArray(
		pako.deflate(new TextEncoder().encode(JSON.stringify(blueprint)))
	);
