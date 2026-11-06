import type { Organization, Person } from 'schema-dts';

import { Bio, employment } from '#root/project/me/zemn/bio/bio.js';
import { Iterable } from '#root/ts/iter/index.js';
import { and_then, None, Some, unwrap_or } from '#root/ts/option/types.js';

export const schema: Person = {
	'@type': 'Person',
	alternateName: Bio.who.handle.text,
	name: Bio.who.fullName.text,
	birthDate: Bio.birthdate.toISOString(),
	jobTitle: unwrap_or(
		and_then(
			Iterable(Bio.timeline)
				.map(v =>
					'tags' in v && v.tags.includes(employment) ? Some(v) : None
				)
				.filter()
				.map(v => ('until' in v ? None : Some(v)))
				.filter()
				.first(),
			v => v.title.text
		),
		undefined
	),
	worksFor: Iterable(Bio.timeline)
		.map(v => ('tags' in v && v.tags.includes(employment) ? Some(v) : None))
		.filter()
		.map(v => ('until' in v ? None : Some(v)))
		.filter()
		.map(v => ('employer' in v ? Some(v) : None))
		.filter()
		.map(
			(v): Organization => ({
				'@type': 'Organization',
				name: v.employer.text,
				url: 'url' in v ? v.url.toString() : undefined,
			})
		)
		.to_array(),
	url: Bio.officialWebsite.toString(),
	sameAs: [
		'https://www.wikidata.org/wiki/Q131339630',
		...Iterable(Bio.links)
			.map(([, u]) =>
				u.origin === Bio.officialWebsite.origin
					? None
					: Some(u.toString())
			)
			.filter()
			.to_array(),
	],
	email: 'mailto:thomas@shadwell.im',
};
