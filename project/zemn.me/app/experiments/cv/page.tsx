import React, { Fragment, ReactNode } from 'react';

import style from '#root/project/zemn.me/app/experiments/cv/page.module.css';
import { accolade, Bio, comment, talk, work } from '#root/project/zemn.me/bio/bio.js';
import priorities from '#root/project/zemn.me/bio/priority.json';
import Link from '#root/project/zemn.me/components/Link/index.js';
import TimeEye from '#root/project/zemn.me/components/TimeEye/TimeEye.js';
import { isDefined, must } from '#root/ts/guard.js';
import { filter, to_array } from '#root/ts/iter/iterable_functional.js';
import { and_then, and_then_or_else, None, Option, Some, unwrap_or } from '#root/ts/option/types.js';
import { MonthYear } from '#root/ts/react/lang/date.js';

const priorityMap = new Map<string, number>(
        priorities.map((id, idx) => [id, priorities.length - idx]),
);
const getPriority = (id: string): number | undefined => priorityMap.get(id);
const mustPriority = (id: string): number => must(isDefined)(getPriority(id));

const minPriorityRecord = '74086941-7c37-4f3e-af9b-4cc8e8bbc749';
const minPriority = mustPriority(minPriorityRecord);

const entries = Bio.timeline
        .filter(e => mustPriority(e.id) >= minPriority)
        .sort((a, b) => (+a.date) - (+b.date))
        .toReversed();

type Event = (typeof Bio.timeline)[number];



function or_null<T>(v: Option<T>): T | null {
	return unwrap_or(v, null);
}

function Event({ event }: { readonly event: Event }) {
	const since = 'since' in event ? Some(event.since) : None;
	const until = 'until' in event ? Some(event.until) : None;
	const date = 'date' in event ? Some(event.date) : None;
	const employer = 'employer' in event ? Some(event.employer) : None;
	const description = 'description' in event && event.description != undefined? Some(event.description) : None;

	// this variable is used to make sure the elements in the right column stay
	// in sync with the number of elemnts in right column for this given event.
	const leftColElements: Option<ReactNode>[] = [
		and_then(employer, employer =>
			<div className={style.leftColumn}>{employer.text}</div>
		),

		Some(<div className={style.leftColumn}>{event.title.text}</div>),
		and_then(description, description => <div className={style.leftColumn} lang={description.language}>
			{description.text}
		</div>)
	];


	const leftColElementsCount = to_array(filter(leftColElements)).length;

	const rightColStyle = {
				gridRow: 'auto / span ' + leftColElementsCount,
			}

	return <div className={style.event} key={event.id}>


		{leftColElements.map((el, idx) => and_then_or_else(
			el,
			el => <Fragment key={idx}>{el}</Fragment>,
			() => null
		))}

		{and_then_or_else(
			date,
			date => <MonthYear className={style.date} date={date} style={rightColStyle} />,
			// has to have a fallback, or the table will get fucked up
			() => null // <div className={style.date}/>
		)}

		{and_then_or_else(
			since,
			since => <MonthYear className={style.since} date={since} style={rightColStyle} />,
			() => null //<div className={style.since} />
		) }

		{and_then_or_else(
			until,
			until => {
				if (typeof until === "string" && until == 'ongoing') {
					return <div className={style.until} style={rightColStyle}>ongoing</div>;
				}
				return <MonthYear className={style.until} date={until} style={rightColStyle} />
			},
			() => null//<div className={style.until} style={rightColStyle} />,
		)}



			</div>
	;
}

function WorkItems() {
        return <>{entries.filter(e => 'tags' in e && e.tags.includes(work)).map(e => <Event event={e} key={e.id} />)}</>;
}

function OtherItems() {
        return (
                <>
                        {entries
                                .filter(e => 'tags' in e && !e.tags.includes(work))
                                .map(e => (
                                        <React.Fragment key={e.id}>
                                                <div>{e.title.text}</div>
                                                {'description' in e && e.description && (
                                                        <div className={style.description}>{e.description.text}</div>
                                                )}
                                        </React.Fragment>
                                ))}
                </>
        );
}

function OldCV() {
        return (
                <div className={`${style.cv} ${style.app}`}>
                        <div className={style.header}>
                                <Link className={style.website} href={Bio.officialWebsite.toString()}>zemn.me</Link>
                                {<div className={style.email}>{Bio.email[0]}</div>}
                                <div className={style.phone}>+1 901 910 1110</div>
								<TimeEye className={style.headerIcon} />

								<MonthYear className={style.date} date={new Date()}/>

                                <div className={`${style.profileName} ${style.name}`}>{Bio.who.name.text}</div>
                        </div>
                        <div className={`${style.rule} ${style.experienceTitle}`}><span>selected experience</span></div>
                        <div className={style.experience}>
                                <WorkItems />
                        </div>
                        <div className={`${style.rule} ${style.worksTitle}`}><span>of note</span></div>
                        <div className={`${style.skills} ${style.works}`}>
                                <OtherItems />
                        </div>
                </div>
        );
}

function Header() {
	return <div className={style.header}>
		<Link className={style.website} href={Bio.officialWebsite.toString()}>
			{Bio.officialWebsite.host}
		</Link>
		<div className={style.email}>{Bio.email[0]}</div>
		<div className={style.phone}>+1 901 910 1110</div>
		<TimeEye className={style.headerIcon} />
		<MonthYear className={style.date} date={new Date()}/>
		<div className={`${style.profileName} ${style.name}`} lang={Bio.who.name.language}>{Bio.who.name.text}</div>
	</div>
}

function interestingEvents() { // memoize this
	return Bio.timeline.filter(e => mustPriority(e.id) >= minPriority)
		.sort((a, b) => (+a.date) - (+b.date)).toReversed()
}

function getValidWork() {
	const workItems = new Map(interestingEvents().filter(
		e => 'tags' in e && e.tags.includes(work) && mustPriority(e.id) >= minPriority
	).map(e => [e.id, e]));


	const supercessions = filter(
	[...workItems.values()]
			.map(i => 'supercedes' in i ? Some([
				i.id, i.supercedes
			] as [
				typeof i.id, typeof i.supercedes
			]) : None)
	)

	for (const [replacementId, replacesId] of supercessions) {
		const replacement = workItems.get(replacementId)!;
		const replaces = workItems.get(replacesId)!;

		workItems.set(replacesId, {
			...replacement,
			// then this 'super item' pretty much begins
			// when the old item started
			... 'since' in replaces ? {
				since: replaces.since,
			} : {}
		});

		workItems.delete(replacesId);
	}

	return [...workItems.values()]
}

function Section({ children }: { readonly children: React.ReactNode }) {
	return <section className={style.section}>
		{children}
	</section>
}

function Work() {
	return <Section>
		{getValidWork().map(e => <Event event={e} key={e.id}/> )}
	</Section>
}

function Talks() {
	return <Section>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(talk)).map(e => <Event event={e} key={e.id} />)}
	</Section>
}

function Accolades() {
	return <Section>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(accolade)).map(e => <Event event={e} key={e.id} />)}
	</Section>
}

function Coverage() {
	return <Section>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(comment)).map(e => <Event event={e} key={e.id} />)}
	</Section>
}


/*
function Disclosures() {Add commentMore actions
	return <section>
		<h2>Papers & Disclosures</h2>
		<ol>
			{entries().filter(e => 'tags' in e && [
				writing, disclosure
			].some(t => e.tags.includes(t))).map(e => <li key={e.id}>
				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}
*/

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
	return <h2 className={style.rule}>{children}</h2>
}


function NewCV() {
	return <div className={style.newCV} >
		<Header/>
		<SectionTitle>Work</SectionTitle>
		<Work/>
		<SectionTitle>Talks</SectionTitle>
		<Talks/>
		<SectionTitle>Accolades</SectionTitle>
		<Accolades/>
		<SectionTitle>Coverage</SectionTitle>
		<Coverage/>
	</div>
}




export default function Page() {
	return <div>
		<NewCV/>
		<OldCV/>
	</div>
}
