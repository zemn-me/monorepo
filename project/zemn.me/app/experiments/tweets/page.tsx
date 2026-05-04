import './page.css';

import fs from 'node:fs/promises';
import path from 'node:path';

import { Metadata } from 'next/types';
import { z } from 'zod';

import Link from '#root/project/zemn.me/components/Link/index.js';
import { Date } from '#root/ts/react/lang/date.js';
import { archivedTweetSchema } from '#root/ts/twitter/archive.js';

const mediaItemSchema = z.object({
	id_str: z.string().optional(),
	media_url: z.string().optional(),
	media_url_https: z.string().optional(),
	url: z.string().optional(),
	display_url: z.string().optional(),
	expanded_url: z.string().optional(),
	type: z.string().optional(),
});

type ArchivedTweet = z.TypeOf<typeof archivedTweetSchema>;
type TweetMedia = z.TypeOf<typeof mediaItemSchema>;

interface TweetViewModel {
	readonly id: string;
	readonly createdAt: globalThis.Date;
	readonly text: string;
	readonly favoriteCount: number;
	readonly retweetCount: number;
	readonly media: readonly TweetMedia[];
}

const ARCHIVE_ROOT = path.join(process.cwd(), 'project/twitter_archive');

async function getJsonFiles(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async entry => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return getJsonFiles(fullPath);
		}
		if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
			return [fullPath];
		}
		return [];
	}));
	return nested.flat();
}

function toNumber(value: string | undefined): number {
	if (value === undefined) {
		return 0;
	}
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) ? n : 0;
}

function uniqueMedia(media: readonly TweetMedia[]): TweetMedia[] {
	const seen = new Set<string>();
	return media.filter(item => {
		const key = item.id_str ?? item.media_url_https ?? item.media_url ?? item.url;
		if (key === undefined) {
			return false;
		}
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function parseMediaCollection(media: unknown[] | undefined): TweetMedia[] {
	if (media === undefined) {
		return [];
	}
	const parsedMedia: TweetMedia[] = [];
	for (const item of media) {
		const parsedItem = mediaItemSchema.safeParse(item);
		if (parsedItem.success) {
			parsedMedia.push(parsedItem.data);
		}
	}
	return parsedMedia;
}

function toTweetViewModel(json: ArchivedTweet): TweetViewModel | undefined {
	const { tweet } = json;
	const createdAt = new globalThis.Date(tweet.created_at);
	if (Number.isNaN(createdAt.valueOf())) {
		return undefined;
	}
	const allMedia = [
		...parseMediaCollection(tweet.entities.media),
		...parseMediaCollection(tweet.extended_entities?.media),
	];

	return {
		id: tweet.id_str,
		createdAt,
		text: tweet.full_text,
		favoriteCount: toNumber(tweet.favorite_count),
		retweetCount: toNumber(tweet.retweet_count),
		media: uniqueMedia(allMedia),
	};
}

async function getTweets(): Promise<TweetViewModel[]> {
	try {
		const files = await getJsonFiles(ARCHIVE_ROOT);
		const records = await Promise.all(files.map(async file => {
			const raw = await fs.readFile(file, 'utf8');
			const parsedTweet = archivedTweetSchema.safeParse(JSON.parse(raw));
			if (!parsedTweet.success) {
				return undefined;
			}
			return toTweetViewModel(parsedTweet.data);
		}));
		return records.filter((tweet): tweet is TweetViewModel => tweet !== undefined)
			.sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf());
	} catch {
		return [];
	}
}

function TweetCard({ tweet }: { readonly tweet: TweetViewModel }) {
	return (
		<article className="tweet-card">
			<header className="tweet-header">
				<Link
					className="tweet-permalink"
					href={`https://x.com/i/status/${tweet.id}`}
					rel="noreferrer"
					target="_blank"
				>
					<Date date={tweet.createdAt} />
				</Link>
				<div className="tweet-metrics">
					<span>♥ {tweet.favoriteCount.toLocaleString('en-US')}</span>
					<span>↻ {tweet.retweetCount.toLocaleString('en-US')}</span>
				</div>
			</header>
			<p className="tweet-text">{tweet.text}</p>
			{tweet.media.length > 0 ? (
				<ul className="tweet-media-grid">
					{tweet.media.map(media => {
						const src = media.media_url_https ?? media.media_url;
						if (src === undefined) {
							return null;
						}
						const alt = media.display_url ?? media.expanded_url ?? 'Tweet media';
						return (
							<li className="tweet-media-item" key={media.id_str ?? src}>
								<img alt={alt} className="tweet-media-image" decoding="async" loading="lazy" src={src} />
							</li>
						);
					})}
				</ul>
			) : null}
		</article>
	);
}

export default async function Page() {
	const tweets = await getTweets();

	return (
		<div className="tweets-page">
			<header className="tweets-page-header">
				<h1 className="tweets-title">Tweet archive</h1>
				<p className="tweets-subtitle">Every archived tweet in one scrollable timeline.</p>
				<p className="tweets-count">{tweets.length.toLocaleString('en-US')} tweets</p>
			</header>

			<div className="tweets-timeline">
				{tweets.map(tweet => (
					<TweetCard key={tweet.id} tweet={tweet} />
				))}
			</div>
		</div>
	);
}

export const metadata: Metadata = {
	title: 'Tweet archive experiment',
	description: 'A browsable timeline of archived tweets.',
};
