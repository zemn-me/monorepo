/* eslint-disable react/forbid-elements */
// remove above when im not feeling lazy
import React from 'react';

import style from '#root/project/zemn.me/app/experiments/cv/page.module.css';
import { Bio, work } from '#root/project/zemn.me/bio/bio.js';
import priorities from '#root/project/zemn.me/bio/priority.json';
import TimeEye from '#root/project/zemn.me/components/TimeEye/TimeEye.js';
import { isDefined, must } from '#root/ts/guard.js';

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

function WorkItem({ event }: { readonly event: Event }) {
        const start = ('since' in event && event.since ? event.since : event.date) as Date;
        const end = 'until' in event ? event.until : undefined;
        const endDate = end && end !== 'ongoing' ? (end as Date) : undefined;
        const employer = 'employer' in event ? event.employer : undefined;
        return (
                <div className={style.work} key={event.id}>
                        {employer && <div className={style.employer}>{employer.text}</div>}
                        <div className={style.position}>{event.title.text}</div>
                        <div className={`${style.date} ${style.start}`}><time dateTime={String(+start)}>{start.getFullYear()}</time></div>
                        {end && <div className={style.end}>{end === 'ongoing' ? 'Ongoing' : endDate?.getFullYear()}</div>}
                        {'description' in event && event.description && (
                                <span className={`${style.timelineDescription} ${style.content}`}>
                                        <p>{event.description.text}</p>
                                </span>
                        )}
                </div>
        );
}

function WorkItems() {
        return <>{entries.filter(e => 'tags' in e && e.tags.includes(work)).map(e => <WorkItem event={e} key={e.id} />)}</>;
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

export default function CV() {
        return (
                <div className={`${style.cv} ${style.app}`}>
                        <div className={style.header}>
                                <a className={style.website} href={Bio.officialWebsite.toString()}>zemn.me</a>
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
