import b64 from 'base64-js';
import pako from 'pako';

import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';

export const ParseBlueprintString = (blueprint: string): BlueprintWrapper =>
	JSON.parse(
		new TextDecoder().decode(
			pako.inflate(b64.toByteArray(blueprint.slice(1)))
		)
	);
