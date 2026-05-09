import {
	MetadataRouteContext,
	metadataToMetaDescriptors,
} from '#root/ts/remix/index.js';

import { metadata } from '../page.js';

export { default } from '../page.js';

export function meta(route: MetadataRouteContext) {
	return metadataToMetaDescriptors(metadata, { route });
}
