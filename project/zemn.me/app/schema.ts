import { ProfilePage, WithContext } from "schema-dts";

import { schema } from "#root/project/zemn.me/bio/schema.js";

export const ProfilePageSchema: WithContext<ProfilePage> = {
	'@context': 'https://schema.org',
	'@type': 'ProfilePage',
	mainEntity: schema,
}
