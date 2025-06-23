import React from 'react';

import style from '#root/project/zemn.me/app/experiments/cv/page.module.css';
import { accolade, Bio, comment, talk, work } from '#root/project/zemn.me/bio/bio.js';
import priorities from '#root/project/zemn.me/bio/priority.json';
import Link from '#root/project/zemn.me/components/Link/index.js';
import TimeEye from '#root/project/zemn.me/components/TimeEye/TimeEye.js';
import { isDefined, must } from '#root/ts/guard.js';
import { filter } from '#root/ts/iter/iterable_functional.js';
import { None, Some } from '#root/ts/option/types.js';
import { Date as DateDisplay } from '#root/ts/react/lang/date.js';

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

function Event({ event }: { readonly event: Event }) {
        const start = ('since' in event && event.since ? event.since : event.date) as Date;
        const end = 'until' in event ? event.until : undefined;
       const employer = 'employer' in event ? event.employer : undefined;
       return (
               <div className={style.work} key={event.id}>
                       {employer && <div className={style.employer}>{employer.text}</div>}
                       <div className={style.position}>{event.title.text}</div>
                       <div className={`${style.date} ${style.start}`}><time dateTime={String(+start)}>{start.getFullYear()}</time></div>
                       {end && (
                               <div className={style.end}>
                                       {typeof end === 'string' ? 'Ongoing' : end.getFullYear()}
                               </div>
                       )}
                        {'description' in event && event.description && (
                                <span className={`${style.timelineDescription} ${style.content}`}>
                                        <p>{event.description.text}</p>
                                </span>
                        )}
                </div>
        );
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
                                <div className={style.date}><time dateTime={String(Date.now())}>{new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</time></div>
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
		<div className={style.date}><time dateTime={String(Date.now())}>
			<DateDisplay date={new Date()}/>
		</time></div>
		<div className={`${style.profileName} ${style.name}`} lang={Bio.who.name.language}>{Bio.who.name.text}</div>
	</div>
}

function interestingEvents() { // memoize this
	return Bio.timeline.filter(e => mustPriority(e.id) >= minPriority)
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

function Work() {
	return <div className={style.newWork}>
		{getValidWork().map(e => <Event event={e} key={e.id}/> )}
	</div>
}

function Talks() {
	return <div>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(talk)).map(e => <Event event={e} key={e.id} />)}
	</div>
}

function Accolades() {
	return <div>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(accolade)).map(e => <Event event={e} key={e.id} />)}
	</div>
}

function Coverage() {
	return <div>
		{interestingEvents().filter(e => 'tags' in e && e.tags.includes(comment)).map(e => <Event event={e} key={e.id} />)}
	</div>
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


function NewCV() {
	return <div className={style.newCV} >
		<Header/>
		<h2>Work</h2>
		<Work/>
		{/* todo: titles */}
		<h2>Talks</h2>
		<Talks/>
		<h2>Accolades</h2>
		<Accolades/>
		<h2>Coverage</h2>
		<Coverage/>
	</div>
}




export default function Page() {
	return <div>
		<NewCV/>
		<OldCV/>
	</div>
}
