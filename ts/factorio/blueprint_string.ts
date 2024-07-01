import b64 from 'base64';
import pako from 'pako';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper';

// The version byte is currently 0 (for all Factorio versions through 1.1)
const versionByte = '0';

export const BlueprintString = z
	.string()
	.transform(z =>
			JSON.parse(
				new TextDecoder().decode(
					pako.inflate(b64.toByteArray(z.slice(1)))
				)
			)
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
