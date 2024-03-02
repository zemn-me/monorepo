import b64 from 'base64-js';
import pako from 'pako';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';

// The version byte is currently 0 (for all Factorio versions through 1.1)
const versionByte = '0';

export const BlueprintString = z
	.string()
	.transform(z =>
		BlueprintWrapper.parse(
			JSON.parse(
				new TextDecoder().decode(
					pako.inflate(b64.toByteArray(z.slice(1)))
				)
			)
		)
	);

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
