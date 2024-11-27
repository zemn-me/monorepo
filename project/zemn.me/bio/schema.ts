import type { Organization, Person, WithContext } from 'schema-dts';

import { Bio, employment } from '#root/project/zemn.me/bio/bio.js';
import { Iterable } from '#root/ts/iter/index.js';
import { None, Some } from '#root/ts/option/option.js';

export const schema: WithContext<Person> = {
	'@context': 'https://schema.org',
	'@type': 'Person',
	name: Bio.who.fullName.text,
	birthDate: Bio.birthdate.toISOString(),
	jobTitle: Iterable(Bio.timeline)
		.map(v => ('tags' in v && v.tags.includes(employment) ? Some(v) : None))
		.filter()
		.map(v => ('until' in v ? None : Some(v)))
		.filter()
		.first()
		.and_then(v => v.title.text)
		.unwrap_or(undefined),
	worksFor: Iterable(Bio.timeline)
		.map(v => ('tags' in v && v.tags.includes(employment) ? Some(v) : None))
		.filter()
		.map(v => ('until' in v ? None : Some(v)))
		.filter()
		.map(
			(v): Organization => ({
				'@type': 'Organization',
				name: v.title.text,
				url: 'url' in v ? v.url.toString() : undefined,
			})
		)
		.to_array(),
	url: Bio.officialWebsite.toString(),
	sameAs: [
		'https://www.wikidata.org/wiki/Q131339630',
		...Iterable(Bio.links)
			.map(([, u]) => u.toString())
			.to_array(),
	],
	email: 'mailto:thomas@shadwell.im',
};
