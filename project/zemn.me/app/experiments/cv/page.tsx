import memoizee from 'memoizee';

import { accolade, Bio, comment, disclosure, talk, work, writing } from '#root/project/zemn.me/bio/bio.js';
import priorities from '#root/project/zemn.me/bio/priority.json';
import { isDefined, must } from '#root/ts/guard.js';



const priorityMap = memoizee(() => new Map<string, number>(
	priorities.map((id, index) => [id, priorities.length - index]),
));

const getPriority = (id: string): number | undefined => priorityMap().get(id);
const mustPriority = (id: string): number => must(isDefined)(getPriority(id));

/**
 * The timeline entry that has the minimum priority to be shown.
 */
const minPriorityRecord = "74086941-7c37-4f3e-af9b-4cc8e8bbc749"

const minPriority = memoizee(() => mustPriority(minPriorityRecord));

const entries = memoizee(() => Bio.timeline.filter(e => mustPriority(e.id) >= minPriority()).sort((a, b) => (+a.date) - (+b.date)).toReversed());


function WorkSection() {
	return <section>
		<h2>Work...</h2>
		<ol>
			{entries().filter(e => 'tags' in e && e.tags.includes(work)).map(e => <li key={e.id}>
				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}

function Talks() {
	return <section>
		<h2>Talks...</h2>
		<ol>
			{entries().filter(e => 'tags' in e && e.tags.includes(talk)).map(e => <li key={e.id}>
				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}



function Accolades() {
	return <section>
		<h2>Accolades...</h2>
		<ol>
			{entries().filter(e => 'tags' in e && e.tags.includes(accolade)).map(e => <li key={e.id}>
				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}

function Coverage() {
	return <section>
		<h2>Coverage & Citiations...</h2>
		<ol>
			{entries().filter(e => 'tags' in e && e.tags.includes(comment)).map(e => <li key={e.id}>

				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}

function Disclosures() {
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



function Others() {
	return <section>
		<h2>Others...</h2>
		<ol>
			{entries().filter(e => 'tags' in e && ![
				accolade, work, talk, writing, comment, disclosure
			].some(t => e.tags.includes(t))).map(e => <li key={e.id}>
				<h3 lang={e.title.language}>{e.title.text}</h3>
				{('description' in e && e.description) ? <p lang={e.description.language}>{e.description.text}</p> : null}
			</li>)}
		</ol>
	</section>
}


export default function CV() {
	return <div>
		<WorkSection />
		<Talks />
		<Disclosures/>
		<Accolades />
		<Coverage/>
		<Others />
	</div>
}
