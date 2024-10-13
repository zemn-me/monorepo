
import { create } from 'xmlbuilder2';

import { Bio } from '#root/project/zemn.me/bio/bio.js';

function main() {

	const nd = create({ version: '1.0' })
		.ele('rss', { version: '2.0' })
		.ele('channel')
		.ele('title').txt(
				`${Bio.who.fullName.text} Bio Timeline`
		).up();

	Bio.timeline.map(v => {
		const n = nd.ele('item')
			.ele('title').txt(v.title.text).up();

		if ('url' in v) n.ele('link').txt(v.url.toString()).up();

		if ('id' in v) n.ele('guid').txt(v.id).up();

		if ('description' in v) n.ele('description').txt(v.description.text)
			.up();

		if ('date' in v) n.ele('pubDate').txt(v.date.toString()).up();
	})

	console.log(nd.end({ prettyPrint: true }));
}


main();
