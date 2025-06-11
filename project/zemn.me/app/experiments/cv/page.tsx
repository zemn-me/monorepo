/* eslint-disable react/forbid-elements */
// remove above when im not feeling lazy
import React from 'react';

import style from '#root/project/zemn.me/app/experiments/cv/page.module.css';
import { Bio, work } from '#root/project/zemn.me/bio/bio.js';
import priorities from '#root/project/zemn.me/bio/priority.json';
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
        const endDate = end instanceof Date ? end : undefined;
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
                                <svg className={`${style.sadIcon} ${style.headerIcon}`} viewBox="0 0 17.78 7.81" xmlns="http://www.w3.org/2000/svg">
                                        <g style={{ stroke: 'var(--fgc)' }} transform="translate(-13.03 -62.53)">
                                                <path d="M16.73 62.66l-3.47 6.02h17.32l-3.47-6.02z" fill="none" strokeWidth=".26" />
                                                <circle cx="21.92" cy="65.47" fill="none" r="1.61" strokeWidth=".16" />
                                                <ellipse cx="21.92" cy="65.47" fill="none" rx="3.23" ry="1.58" strokeWidth=".23" />
                                                <path d="M23.53 68.65a1.61 1.61 0 0 1-3.22 0c0-.9.72-1.2 1.61-1.62.9.42 1.61.73 1.61 1.62z" strokeWidth=".16" style={{ fill: 'var(--bgc)' }} />
                                                <circle cx="21.92" cy="65.47" r=".54" strokeWidth=".08" style={{ fill: 'var(--fgc)' }} />
                                        </g>
                                </svg>
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
