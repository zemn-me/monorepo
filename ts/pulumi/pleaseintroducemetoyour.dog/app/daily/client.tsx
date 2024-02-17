'use client';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useCallback, useRef } from 'react';
import { z } from 'zod';

import Link from '#root/project/zemn.me/components/Link/index.js';

export const PostProps = z.object({
	media: z
		.object({
			reddit_video: z
				.object({
					dash_url: z.string().optional().nullable(),
					hls_url: z.string().optional().nullable(),
					fallback_url: z.string().optional().nullable(),
					scrubber_media_url: z.string().optional().nullable(),
				})
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
	preview: z
		.object({
			images: z
				.array(
					z.object({
						source: z
							.object({
								width: z.number().optional().nullable(),
							})
							.optional()
							.nullable(),
					})
				)
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
	url: z.string().optional().nullable(),
	permalink: z.string().optional().nullable(),
	title: z.string(),
});

const SearchResponseProps = z.object({
	data: z
		.object({
			children: z
				.array(
					z.object({
						data: PostProps,
					})
				)
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
});

function Post(post: z.TypeOf<typeof PostProps>) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const onClick = useCallback(() => void videoRef.current?.play(), []);
	const video = post.media?.reddit_video;
	return (
		<article
			className={classNames('post', post.media ? 'media' : undefined)}
			onClick={onClick}
		>
			{post.media ? (
				<video autoPlay loop muted playsInline ref={videoRef}>
					{[video?.hls_url, video?.dash_url, video?.fallback_url].map(
						source =>
							source ? <source key={source} src={source} /> : null
					)}
				</video>
			) : (
				<img src={post.url?.replace(/\.gifv$/, 'gif')} />
			)}
			{post.permalink ? (
				<Link href={'https://reddit.com' + post.permalink}>
					<header>{post.title}</header>
				</Link>
			) : null}
		</article>
	);
}

const placeHolderData: z.TypeOf<typeof SearchResponseProps> = {
	data: {
		children: [
			{
				data: {
					title: 'a Lovely Dog!',
				},
			},

			{
				data: {
					title: 'my goodness!',
				},
			},

			{
				data: {
					title: 'hims ?',
				},
			},
		],
	},
};

export function DogsOfTheDay() {
	const doggs = useQuery(
		['doggs!'],
		(): Promise<z.TypeOf<typeof SearchResponseProps>> =>
			fetch(
				`https://www.reddit.com/r/aww/search.json?raw_json=1&q=dog&sort=top&t=day&restrict_sr=1`
			)
				.then(r => r.json())
				.then(j => SearchResponseProps.parseAsync(j)),
		{
			placeholderData: placeHolderData,
		}
	);

	return (
		<>
			<h1>Top doggoes of the day!!</h1>
			{doggs.isLoading ? `we are loading the dogs!! 🐕 🐶` : null}
			{doggs.isError
				? `we had an issue loading the doggs... 🐕😭 ... ${doggs.error} ...`
				: null}
			{doggs.data?.data?.children?.map((post, i) => (
				<Post key={i} {...post.data} />
			)) ?? null}
			<h1>That’s all for today ‼️ Check back tomorrow 🐕</h1>
			<footer>for baby 2016-{new Date().getFullYear()}</footer>
		</>
	);
}
