import { Bio, Event, employment } from '#root/project/me/zemn/bio/bio.js';
import {
	DataProperty,
	itemPropScope,
	itemScope,
} from '#root/ts/schema.org/schema.js';

function isCurrentEmployment(event: Event): boolean {
	return event.tags?.includes(employment) === true && !('until' in event);
}

function hasEmployer(
	event: Event
): event is Event & { readonly employer: NonNullable<Event['employer']> } {
	return event.employer !== undefined;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 'YYYY-MM-DD'.length);
}

const currentEmployment: readonly Event[] =
	Bio.timeline.filter(isCurrentEmployment);
const currentEmployers = currentEmployment.filter(hasEmployer);
const currentJobTitle = currentEmployment[0]?.title.text;

const sameAs = [
	'https://www.wikidata.org/wiki/Q131339630',
	...Bio.links.map(([, url]) => url.toString()),
];

export function PersonMicrodata() {
	return (
		<>
			<DataProperty
				item="Person"
				name="alternateName"
				value={Bio.who.handle.text}
			/>
			<DataProperty
				item="Person"
				name="birthDate"
				value={isoDate(Bio.birthdate)}
			/>
			<DataProperty
				item="Person"
				name="email"
				value="mailto:thomas@shadwell.im"
			/>
			<DataProperty
				item="Person"
				name="name"
				value={Bio.who.fullName.text}
			/>
			<DataProperty
				item="Person"
				name="url"
				value={Bio.officialWebsite}
			/>
			{currentJobTitle ? (
				<DataProperty
					item="Person"
					name="jobTitle"
					value={currentJobTitle}
				/>
			) : null}
			{sameAs.map(url => (
				<DataProperty
					item="Person"
					key={url}
					name="sameAs"
					value={url}
				/>
			))}
			{currentEmployers.map(event => (
				<span
					hidden
					key={event.id}
					{...itemPropScope('Person', 'worksFor', 'Organization')}
				>
					<DataProperty
						item="Organization"
						name="name"
						value={event.employer.text}
					/>
					{event.url instanceof URL ? (
						<DataProperty
							item="Organization"
							name="url"
							value={event.url}
						/>
					) : null}
				</span>
			))}
		</>
	);
}

export function PersonMicrodataItem() {
	return (
		<span hidden {...itemScope('Person')}>
			<PersonMicrodata />
		</span>
	);
}
