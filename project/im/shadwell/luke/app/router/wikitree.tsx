import { metadata } from '#root/project/im/shadwell/luke/app/wikitree/page.js';
import {
	MetadataRouteContext,
	metadataToMetaDescriptors,
} from '#root/ts/remix/index.js';

export { default } from '#root/project/im/shadwell/luke/app/wikitree/page.js';

export function meta(route: MetadataRouteContext) {
	return metadataToMetaDescriptors(metadata, { route });
}
