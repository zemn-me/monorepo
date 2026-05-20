import { timelineRssFeed } from '#root/project/me/zemn/app/timeline/rss.xml/feed.js';

export const dynamic = 'force-static';

export function GET(): Response {
	return new Response(timelineRssFeed(), {
		headers: {
			'Cache-Control': 'public, max-age=3600',
			'Content-Type': 'application/rss+xml; charset=utf-8',
		},
	});
}
