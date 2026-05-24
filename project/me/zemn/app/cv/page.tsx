import { Fragment, type ReactNode, Suspense } from 'react';

import { ModeSwitch } from '#root/project/me/zemn/app/cv/client.js';
import style from '#root/project/me/zemn/app/cv/page.module.css';
import {
	accolade,
	Bio,
	type Event as BioEvent,
	comment,
	disclosure,
	employment,
	eventHasStarted,
	type Tag,
	talk,
	work,
	writing,
} from '#root/project/me/zemn/bio/bio.js';
import priorities from '#root/project/me/zemn/bio/priority.json';
import Link from '#root/project/me/zemn/components/Link/index.js';
import TimeEye from '#root/project/me/zemn/components/TimeEye/TimeEye.js';
import { MonthYear } from '#root/ts/react/lang/date.js';

const priorityMap = new Map<string, number>(
	priorities.map((id, idx) => [id, priorities.length - idx])
);

const minPriorityRecord = '74086941-7c37-4f3e-af9b-4cc8e8bbc749';
const minPriority =
	priorityMap.get(minPriorityRecord) ?? Number.NEGATIVE_INFINITY;

const nonExperienceWorkTags = [
	accolade,
	comment,
	disclosure,
	talk,
	writing,
] as const;
const writingAndTalkTags = [disclosure, talk, writing] as const;

type CVMode = 'long' | 'short';

interface NoteSection {
	readonly areaClassName?: string;
	readonly citationTitles?: boolean;
	readonly events: readonly BioEvent[];
	readonly id: string;
	readonly title?: ReactNode;
}

interface CVContent {
	readonly experience: readonly BioEvent[];
	readonly noteSections: readonly NoteSection[];
}

function classNames(
	...classes: readonly (false | string | undefined)[]
): string {
	return classes
		.filter((className): className is string => typeof className === 'string')
		.join(' ');
}

function priorityOf(event: BioEvent): number {
	return priorityMap.get(event.id) ?? Number.NEGATIVE_INFINITY;
}

function byPriority(a: BioEvent, b: BioEvent): number {
	return priorityOf(b) - priorityOf(a);
}

function averagePriority(events: readonly BioEvent[]): number {
	if (events.length === 0) return Number.NEGATIVE_INFINITY;

	const total = events.reduce((sum, event) => sum + priorityOf(event), 0);
	return total / events.length;
}

function byAverageSectionPriority(
	a: NoteSection,
	b: NoteSection
): number {
	return averagePriority(b.events) - averagePriority(a.events);
}

function hasTag(event: BioEvent, tag: Tag): boolean {
	return event.tags?.includes(tag) ?? false;
}

function hasAnyTag(event: BioEvent, tags: readonly Tag[]): boolean {
	return tags.some(tag => hasTag(event, tag));
}

function startedPriorityEvents(): BioEvent[] {
	return Bio.timeline
		.filter(event => eventHasStarted(event))
		.filter(event => priorityOf(event) >= minPriority)
		.sort(byPriority);
}

function eventStart(event: BioEvent): Date {
	return event.since ?? event.date;
}

function byEventStart(a: BioEvent, b: BioEvent): number {
	return +eventStart(b) - +eventStart(a);
}

function eventEnd(event: BioEvent): Date | undefined {
	return event.until instanceof Date ? event.until : undefined;
}

function isExperience(event: BioEvent): boolean {
	if (hasTag(event, employment)) return true;
	if (!hasTag(event, work)) return false;
	if (event.until === undefined) return false;
	return !hasAnyTag(event, nonExperienceWorkTags);
}

function mergeSupersededEvents(events: readonly BioEvent[]): BioEvent[] {
	const eventsById = new Map(events.map(event => [event.id, event]));

	for (const event of events) {
		if (event.supercedes === undefined) continue;

		const superseded = eventsById.get(event.supercedes);
		if (superseded === undefined) continue;

		eventsById.set(event.id, {
			...event,
			since: eventStart(superseded),
		});
		eventsById.delete(event.supercedes);
	}

	return [...eventsById.values()];
}

const experienceEvents = mergeSupersededEvents(
	startedPriorityEvents().filter(isExperience)
).sort((a, b) => +eventStart(b) - +eventStart(a));

const experienceEventIds = new Set(
	experienceEvents.flatMap(event =>
		event.supercedes === undefined
			? [event.id]
			: [event.id, event.supercedes]
	)
);

const noteEvents = startedPriorityEvents().filter(
	event => !experienceEventIds.has(event.id)
);

function shortContent(): CVContent {
	const primaryNotes = noteEvents
		.filter(event => event.description !== undefined)
		.slice(0, 4);
	const primaryNoteIds = new Set(primaryNotes.map(event => event.id));
	const writingAndTalkNotes = noteEvents
		.filter(event => !primaryNoteIds.has(event.id))
		.filter(event => event.description !== undefined)
		.filter(event => hasAnyTag(event, writingAndTalkTags))
		.slice(0, 4);

	return {
		experience: experienceEvents.slice(0, 6),
		noteSections: [
			{
				areaClassName: style.works,
				events: primaryNotes,
				id: 'short-primary',
				title: 'selected highlights',
			},
			{
				areaClassName: style.works2,
				events: writingAndTalkNotes,
				id: 'short-writing',
			},
		],
	};
}

function longContent(): CVContent {
	const coverageNotes = noteEvents
		.filter(event => hasTag(event, comment))
		.sort(byEventStart);
	const coverageNoteIds = new Set(coverageNotes.map(event => event.id));
	const talkNotes = noteEvents
		.filter(
			event => !coverageNoteIds.has(event.id) && hasTag(event, talk)
		)
		.sort(byEventStart);
	const talkNoteIds = new Set(talkNotes.map(event => event.id));
	const disclosureNotes = noteEvents
		.filter(
			event =>
				!coverageNoteIds.has(event.id) &&
				!talkNoteIds.has(event.id) &&
				hasTag(event, disclosure)
		)
		.sort(byEventStart);
	const disclosureNoteIds = new Set(
		disclosureNotes.map(event => event.id)
	);
	const writingNotes = noteEvents
		.filter(
			event =>
				!coverageNoteIds.has(event.id) &&
				!talkNoteIds.has(event.id) &&
				!disclosureNoteIds.has(event.id) &&
				hasTag(event, writing)
		)
		.sort(byEventStart);
	const writingNoteIds = new Set(writingNotes.map(event => event.id));
	const accoladeNotes = noteEvents
		.filter(
			event =>
				!coverageNoteIds.has(event.id) &&
				!talkNoteIds.has(event.id) &&
				!disclosureNoteIds.has(event.id) &&
				!writingNoteIds.has(event.id) &&
				hasTag(event, accolade)
		)
		.sort(byEventStart);

	return {
		experience: experienceEvents,
		noteSections: [
			{
				citationTitles: true,
				events: writingNotes,
				id: 'long-writing',
				title: 'writing',
			},
			{
				citationTitles: true,
				events: talkNotes,
				id: 'long-talks',
				title: 'talks',
			},
			{
				citationTitles: true,
				events: disclosureNotes,
				id: 'long-disclosures',
				title: 'disclosures',
			},
			{
				citationTitles: true,
				events: coverageNotes,
				id: 'long-coverage',
				title: 'coverage',
			},
			{
				citationTitles: true,
				events: accoladeNotes,
				id: 'long-accolades',
				title: 'accolades',
			},
		].sort(byAverageSectionPriority),
	};
}

function cvContent(mode: CVMode): CVContent {
	return mode === 'long' ? longContent() : shortContent();
}

function Year({ className, date }: DateProps) {
	return (
		<time className={className} dateTime={date.toISOString()}>
			{date.getUTCFullYear()}
		</time>
	);
}

interface DateProps {
	readonly className?: string;
	readonly date: Date;
}

function formatDuration(start: Date, end: Date): string {
	const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
	const endMonth = end.getUTCFullYear() * 12 + end.getUTCMonth();
	const months = Math.max(0, endMonth - startMonth);

	if (months === 0) return '< 1 month';
	if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;

	const years = Math.max(1, Math.round(months / 12));
	return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function stripEmployerSuffix(title: string, employer: string): string {
	const suffix = `, ${employer}`;
	if (!title.endsWith(suffix)) return title;
	return title.slice(0, -suffix.length);
}

interface Role {
	readonly employer?: string;
	readonly position: string;
}

function splitRole(event: BioEvent): Role {
	if (event.employer !== undefined) {
		return {
			employer: event.employer.text,
			position: stripEmployerSuffix(
				event.title.text,
				event.employer.text
			),
		};
	}

	const comma = event.title.text.lastIndexOf(',');
	if (comma === -1) {
		return {
			position: event.title.text,
		};
	}

	return {
		employer: event.title.text.slice(comma + 1).trim(),
		position: event.title.text.slice(0, comma).trim(),
	};
}

function Header() {
	return (
		<header className={style.header}>
			<Link
				className={style.website}
				href={Bio.officialWebsite.toString()}
			>
				{Bio.officialWebsite.host}
			</Link>
			<div className={style.email}>{Bio.email[0]}</div>
			<div className={style.phone}>phone on request</div>
			<TimeEye aria-hidden className={style.headerIcon} />
			<MonthYear className={style.date} date={new Date()} />
			<h1 className={style.name} lang={Bio.who.name.language}>
				{Bio.who.name.text}
			</h1>
		</header>
	);
}

function SectionRule({
	areaClassName,
	children,
}: {
	readonly areaClassName?: string;
	readonly children: ReactNode;
}) {
	return (
		<h2 className={classNames(style.rule, areaClassName)}>
			<span>{children}</span>
		</h2>
	);
}

function ExperienceItem({ event }: { readonly event: BioEvent }) {
	const start = eventStart(event);
	const end = eventEnd(event);
	const role = splitRole(event);

	return (
		<section className={style.work}>
			{role.employer && (
				<div className={style.employer}>{role.employer}</div>
			)}
			<div className={style.position}>{role.position}</div>
			<Year className={style.start} date={start} />
			<div className={style.end}>
				{end === undefined ? 'Ongoing' : <Year date={end} />}
			</div>
			<div className={style.duration}>
				{formatDuration(start, end ?? new Date())}
			</div>
			{event.description && (
				<div className={style.content} lang={event.description.language}>
					<p>{event.description.text}</p>
				</div>
			)}
		</section>
	);
}

function Experience({ events }: { readonly events: readonly BioEvent[] }) {
	return (
		<div className={style.experience}>
			{events.map(event => (
				<ExperienceItem event={event} key={event.id} />
			))}
		</div>
	);
}

function EventTitle({
	citation,
	className,
	event,
}: {
	readonly citation?: boolean;
	readonly className?: string;
	readonly event: BioEvent;
}) {
	const href =
		event.url instanceof URL ? event.url.toString() : event.url?.value;
	const title = citation ? (
		<CitationTitle event={event} />
	) : (
		<span lang={event.title.language}>{event.title.text}</span>
	);

	if (href === undefined) {
		return <div className={className}>{title}</div>;
	}

	return (
		<Link className={className} href={href}>
			{title}
		</Link>
	);
}

function needsFullStop(title: string): boolean {
	return !/[.!?]$/.test(title.trim());
}

function CitationTitle({ event }: { readonly event: BioEvent }) {
	const title = event.title.text;
	const publisher = event.publisher;

	return (
		<>
			<span className={style.citationText}>
				({eventStart(event).getUTCFullYear()}){' '}
			</span>
			<span className={style.citationText} lang={event.title.language}>
				{title}
			</span>
			{publisher && (
				<>
					<span className={style.citationText}>
						{needsFullStop(title) ? '. ' : ' '}
					</span>
					<span
						className={style.citationPublisher}
						lang={publisher.language}
					>
						{publisher.text}
					</span>
					{needsFullStop(publisher.text) && (
						<span className={style.citationText}>.</span>
					)}
				</>
			)}
		</>
	);
}

function Note({
	citationTitle,
	event,
}: {
	readonly citationTitle?: boolean;
	readonly event: BioEvent;
}) {
	return (
		<section className={style.note}>
			<EventTitle
				citation={citationTitle}
				className={style.noteTitle}
				event={event}
			/>
			{event.description && (
				<p
					className={style.description}
					lang={event.description.language}
				>
					{event.description.text}
				</p>
			)}
		</section>
	);
}

function Notes({
	areaClassName,
	citationTitles,
	events,
}: {
	readonly areaClassName?: string;
	readonly citationTitles?: boolean;
	readonly events: readonly BioEvent[];
}) {
	return (
		<div className={classNames(style.notes, areaClassName)}>
			{events.map(event => (
				<Note
					citationTitle={citationTitles}
					event={event}
					key={event.id}
				/>
			))}
		</div>
	);
}

function FutureMark() {
	return (
		<svg
			aria-hidden
			className={style.future}
			viewBox="0 0 446 348"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M174 0L54 120l33 32L207 33 174 0zm98 0l-32 33 119 119 33-32L272 0zm-49 59L109 174l114 114 115-114L223 59zM33 141L0 174l33 33 33-33-33-33zm380 0l-32 33 32 33 33-33-33-33zM87 195l-33 33 120 120 33-33L87 195zm272 0L240 315l32 33 120-120-33-33z"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function ModeSwitchFallback() {
	return (
		<nav
			aria-label="CV length"
			className={style.modeSwitch}
			data-mode="long"
		>
			<span className={style.modeButton}>
				short
			</span>
			<span aria-current="true" className={style.modeButton}>
				long
			</span>
		</nav>
	);
}

function CV({
	content,
	mode,
}: {
	readonly content: CVContent;
	readonly mode: CVMode;
}) {
	return (
		<article
			className={classNames(
				style.cv,
				mode === 'long' ? style.longCV : style.shortCV
			)}
		>
			<Header />
			<SectionRule areaClassName={style.experienceTitle}>
				selected experience
			</SectionRule>
			<Experience events={content.experience} />
			{content.noteSections
				.filter(section => section.events.length > 0)
				.map((section, index) => (
					<Fragment key={section.id}>
						{section.title && (
							<SectionRule
								areaClassName={
									index === 0
										? style.worksTitle
										: undefined
								}
							>
								{section.title}
							</SectionRule>
						)}
						<Notes
							areaClassName={section.areaClassName}
							citationTitles={section.citationTitles}
							events={section.events}
						/>
					</Fragment>
				))}
			<FutureMark />
		</article>
	);
}

export default function Page() {
	return (
		<main className={style.page}>
			<Suspense fallback={<ModeSwitchFallback />}>
				<ModeSwitch />
			</Suspense>
			<CV content={cvContent('short')} mode="short" />
			<CV content={cvContent('long')} mode="long" />
		</main>
	);
}
