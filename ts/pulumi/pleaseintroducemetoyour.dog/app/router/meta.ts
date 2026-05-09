import {
	Metadata,
	MetadataRouteContext,
	metadataToMetaDescriptors,
} from '#root/ts/remix/index.js';
import { metadata as inheritedMetadata } from '../layout.js';

export function pageMeta(metadata: Metadata) {
	return (route: MetadataRouteContext) =>
		metadataToMetaDescriptors(metadata, {
			inheritedMetadata,
			route,
		});
}

export function rootMeta(route: MetadataRouteContext) {
	return metadataToMetaDescriptors(inheritedMetadata, { route });
}
