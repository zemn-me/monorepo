import b64 from 'base64-js';
import * as pako from 'pako';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';
import { safeParseJSON } from '#root/ts/json.js';
import { Err, Ok, unwrap_or_else } from '#root/ts/result/result.js';
import { Base64 } from '#root/ts/zod/util.js';

// The version byte is currently 0 (for all Factorio versions through 1.1)
const versionByte = '0';

export const BlueprintString = z
	.string()
	.refine(v => v[0] == versionByte, {
		message: `Factorio blueprint must start with version byte "${versionByte}".`,
	})
	.transform(v => v.slice(1))
	.pipe(Base64)
	.transform((val, ctx) => {
		const inflated = (() => {
			try {
				return Ok(pako.inflate(val));
			} catch (error) {
				return Err(error);
			}
		})();

		return unwrap_or_else(inflated, error => {
			ctx.addIssue({
				code: 'custom',
				message: `invalid flate compression: ${error}`,
			});

			return z.NEVER;
		});
	})
	.transform((val, ctx) =>
		unwrap_or_else(safeParseJSON(new TextDecoder().decode(val)), error => {
			ctx.addIssue({
				code: 'custom',
				message: `invalid JSON: ${error}`,
				fatal: true,
			});
			return z.NEVER;
		})
	)
	.pipe(BlueprintWrapper);

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
